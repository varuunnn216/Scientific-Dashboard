from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional, List
import logging

from database import engine, get_db, Base
from models import Compound
import schemas

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Scientific Compound Data API",
    description="REST API for exploring multi-dimensional compound data",
    version="1.0.0",
)

# Update this list with your deployed frontend URL when you deploy
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://scientific-dashboard-ui.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def validate_database_connection():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Database is unreachable; API started without validating tables: %s", exc)


@app.get("/")
def root():
    return {"message": "Scientific Compound Data API is running"}


@app.get("/compounds", response_model=schemas.PaginatedCompounds)
def get_compounds(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    min_weight: Optional[float] = None,
    max_weight: Optional[float] = None,
    min_toxicity: Optional[float] = None,
    max_toxicity: Optional[float] = None,
    sort_by: str = Query("id", pattern="^(id|name|molecular_weight|toxicity_score|binding_affinity)$"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Compound)

    if category:
        query = query.filter(Compound.category == category)
    if min_weight is not None:
        query = query.filter(Compound.molecular_weight >= min_weight)
    if max_weight is not None:
        query = query.filter(Compound.molecular_weight <= max_weight)
    if min_toxicity is not None:
        query = query.filter(Compound.toxicity_score >= min_toxicity)
    if max_toxicity is not None:
        query = query.filter(Compound.toxicity_score <= max_toxicity)

    total = query.count()

    sort_column = getattr(Compound, sort_by)
    sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    query = query.order_by(sort_column)

    results = query.offset((page - 1) * page_size).limit(page_size).all()

    return schemas.PaginatedCompounds(
        total=total, page=page, page_size=page_size, results=results
    )


@app.get("/compounds/stats", response_model=schemas.StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Compound).count()

    category_rows = (
        db.query(
            Compound.category,
            func.avg(Compound.molecular_weight).label("avg_mw"),
            func.avg(Compound.toxicity_score).label("avg_tox"),
            func.avg(Compound.binding_affinity).label("avg_ba"),
            func.count(Compound.id).label("count"),
        )
        .group_by(Compound.category)
        .all()
    )

    categories = [
        schemas.CategoryStat(
            category=row.category,
            avg_molecular_weight=round(row.avg_mw, 2),
            avg_toxicity_score=round(row.avg_tox, 2),
            avg_binding_affinity=round(row.avg_ba, 2),
            count=row.count,
        )
        for row in category_rows
    ]

    # molecular weight histogram buckets (100-wide, 0-800)
    buckets = []
    for lo in range(0, 800, 100):
        hi = lo + 100
        count = (
            db.query(Compound)
            .filter(Compound.molecular_weight >= lo, Compound.molecular_weight < hi)
            .count()
        )
        buckets.append({"bucket": f"{lo}-{hi}", "count": count})

    return schemas.StatsResponse(
        total_compounds=total,
        categories=categories,
        molecular_weight_distribution=buckets,
    )


@app.get("/compounds/{compound_id}", response_model=schemas.CompoundResponse)
def get_compound(compound_id: int, db: Session = Depends(get_db)):
    compound = db.query(Compound).filter(Compound.id == compound_id).first()
    if not compound:
        raise HTTPException(status_code=404, detail="Compound not found")
    return compound


@app.post("/compounds", response_model=schemas.CompoundResponse, status_code=201)
def create_compound(compound: schemas.CompoundCreate, db: Session = Depends(get_db)):
    db_compound = Compound(**compound.model_dump())
    db.add(db_compound)
    db.commit()
    db.refresh(db_compound)
    return db_compound


@app.get("/compounds/categories/list", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    rows = db.query(Compound.category).distinct().all()
    return [r[0] for r in rows]
