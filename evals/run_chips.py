"""Run one strict result-comparison trial per UI example without touching the baseline."""
import json

from fastapi.encoders import jsonable_encoder

from run import Budget, HERE, configured, execute, read_jsonl, run_case, validate


def main():
    if not configured():
        raise SystemExit("Configure a provider credential before running the examples.")
    cases = read_jsonl(HERE / "chips.jsonl")
    expected = {}
    for case in cases:
        columns, rows, truncated = execute(*validate(case["gold_sql"]))
        expected[case["id"]] = (len(columns), jsonable_encoder(rows), truncated)

    budget = Budget()
    failed = False
    for case in cases:
        result = run_case(case, budget, expected)
        failed |= not result["pass"]
        print(json.dumps({"id": case["id"], **result}), flush=True)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
