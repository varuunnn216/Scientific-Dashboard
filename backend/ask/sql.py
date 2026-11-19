"""Validate PostgreSQL's parsed syntax tree before opening a database connection."""
from pglast import ast, enums, parse_sql, scan
from pglast.parser import ParseError
from pglast.stream import RawStream

ROW_CAP = 200
COLUMNS = frozenset({
    "id", "name", "molecular_formula", "molecular_weight", "solubility",
    "toxicity_score", "binding_affinity", "category", "created_at",
})
FUNCTIONS = frozenset({
    "count", "sum", "avg", "min", "max", "round", "lower", "upper", "date_trunc",
})
OPERATORS = frozenset({
    "=", "<>", "!=", "<", ">", "<=", ">=", "+", "-", "*", "/", "%", "~~", "!~~",
    "~~*", "!~~*",
})
TYPES = frozenset({"numeric", "int4", "int8", "float8", "text", "date"})
SELECT_FIELDS = frozenset({
    "distinctClause", "targetList", "fromClause", "whereClause", "groupClause",
    "havingClause", "sortClause", "limitOffset", "limitCount", "limitOption",
    "withClause", "op",
})


class UnsafeSQL(ValueError):
    pass


def require(condition, message="Use a simple read-only query on compounds."):
    if not condition:
        raise UnsafeSQL(message)


def string_parts(nodes):
    require(all(isinstance(node, ast.String) for node in nodes))
    return tuple(node.sval for node in nodes)


def expression(node, columns, qualifier, depth=0):
    require(depth < 24, "The query is too complex.")
    if node is None:
        return
    if isinstance(node, ast.ColumnRef):
        if isinstance(node.fields[-1], ast.A_Star):
            require(len(node.fields) == 1 or string_parts(node.fields[:-1]) == (qualifier,))
            return
        parts = string_parts(node.fields)
        require(parts[-1] in columns and parts[:-1] in ((), (qualifier,)), "Use known columns only.")
        return
    if isinstance(node, ast.A_Const):
        return
    if isinstance(node, ast.FuncCall):
        require(len(node.funcname) == 1 and string_parts(node.funcname)[0] in FUNCTIONS,
                "Use approved aggregate and scalar functions only.")
        require(not any((node.over, node.agg_order, node.agg_filter, node.agg_within_group, node.func_variadic)))
        args = node.args or ()
    elif isinstance(node, ast.A_Expr):
        require(node.kind in {
            enums.A_Expr_Kind.AEXPR_OP, enums.A_Expr_Kind.AEXPR_IN,
            enums.A_Expr_Kind.AEXPR_BETWEEN, enums.A_Expr_Kind.AEXPR_NOT_BETWEEN,
            enums.A_Expr_Kind.AEXPR_LIKE, enums.A_Expr_Kind.AEXPR_ILIKE,
        })
        require(string_parts(node.name) in {(op,) for op in OPERATORS | {"BETWEEN", "NOT BETWEEN"}})
        args = (node.lexpr, node.rexpr)
    elif isinstance(node, (ast.BoolExpr, ast.CoalesceExpr)):
        args = node.args
    elif isinstance(node, (ast.NullTest, ast.BooleanTest)):
        args = (node.arg,)
    elif isinstance(node, ast.TypeCast):
        target = node.typeName
        names = string_parts(target.names)
        require(names[-1] in TYPES and names[:-1] in ((), ("pg_catalog",)))
        require(not any((target.arrayBounds, target.typmods, target.setof, target.pct_type)))
        args = (node.arg,)
    elif isinstance(node, tuple):
        args = node
    else:
        raise UnsafeSQL("This SQL expression is outside the supported query syntax.")
    for arg in args:
        expression(arg, columns, qualifier, depth + 1)


def integer_literal(node):
    require(isinstance(node, ast.A_Const) and isinstance(node.val, ast.Integer) and node.val.ival >= 0,
            "LIMIT and OFFSET must be non-negative integer literals.")
    return node.val.ival


def select(statement, cte=None, inner=False):
    require(isinstance(statement, ast.SelectStmt), "Only SELECT is supported.")
    require(all(not getattr(statement, key) for key in statement if key not in SELECT_FIELDS))
    require(statement.op == enums.SetOperation.SETOP_NONE and statement.limitOption != enums.LimitOption.LIMIT_OPTION_WITH_TIES)
    if statement.withClause:
        clause = statement.withClause
        require(not inner and not clause.recursive and len(clause.ctes) == 1)
        item = clause.ctes[0]
        require(item.ctename != "compounds" and not any((item.aliascolnames, item.search_clause, item.cycle_clause)))
        cte = (item.ctename, select(item.ctequery, inner=True))

    require(statement.fromClause and len(statement.fromClause) == 1, "Use one data source per SELECT.")
    relation = statement.fromClause[0]
    require(isinstance(relation, ast.RangeVar) and not relation.catalogname and not relation.schemaname)
    require(not relation.alias or not relation.alias.colnames)
    if relation.relname == "compounds":
        relation.schemaname = "public"
        relation.inh = False
        columns = COLUMNS
    else:
        require(cte and relation.relname == cte[0], "Use the compounds table only.")
        columns = cte[1]
    qualifier = relation.alias.aliasname if relation.alias else relation.relname

    outputs = set()
    for target in statement.targetList or ():
        expression(target.val, columns, qualifier)
        if target.name:
            outputs.add(target.name)
        elif isinstance(target.val, ast.ColumnRef):
            final = target.val.fields[-1]
            outputs.update(columns if isinstance(final, ast.A_Star) else (final.sval,))
        elif inner:
            raise UnsafeSQL("Name calculated columns in a WITH query.")
    require(statement.targetList)
    require(statement.distinctClause in (None, (None,)), "Use DISTINCT without ON.")
    for node in (statement.whereClause, statement.groupClause, statement.havingClause):
        expression(node, columns, qualifier)
    for sort in statement.sortClause or ():
        require(not sort.useOp)
        expression(sort.node, columns | outputs, qualifier)
    if statement.limitOffset is not None:
        require(integer_literal(statement.limitOffset) <= 10000)
    if statement.limitCount is not None:
        integer_literal(statement.limitCount)
    return frozenset(outputs)


def validate(sql):
    require(isinstance(sql, str) and 0 < len(sql) <= 3000, "The SQL exceeds the allowed length.")
    require(sql.isascii() and all(char.isprintable() or char in "\t\r\n" for char in sql))
    try:
        tokens = scan(sql)
        require(tokens and tokens[0].name in {"SELECT", "WITH"}, "Only SELECT is supported.")
        require(all(token.name not in {"SQL_COMMENT", "C_COMMENT"} for token in tokens),
                "SQL comments are forbidden.")
        semicolons = [token for token in tokens if sql[token.start:token.end + 1] == ";"]
        require(not semicolons or semicolons == [tokens[-1]], "Use one SQL statement.")
        statements = parse_sql(sql)
        require(len(statements) == 1)
        statement = statements[0].stmt
        select(statement)
        original_limit = integer_literal(statement.limitCount) if statement.limitCount is not None else None
        capped = original_limit is None or original_limit > ROW_CAP
        statement.limitOption = enums.LimitOption.LIMIT_OPTION_COUNT
        statement.limitCount = ast.A_Const(val=ast.Integer(ival=ROW_CAP + 1 if capped else original_limit))
        probe = RawStream()(statement)
        if capped:
            statement.limitCount = ast.A_Const(val=ast.Integer(ival=ROW_CAP))
        return RawStream()(statement), probe
    except UnsafeSQL:
        raise
    except (ParseError, ValueError, TypeError, AttributeError, IndexError, RecursionError, RuntimeError) as exc:
        raise UnsafeSQL("The SQL could not be parsed.") from exc
