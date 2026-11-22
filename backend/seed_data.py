"""
Insert missing names from the reproducible synthetic compound fixture.
Usage: python seed_data.py
"""
import random
from datetime import datetime, timezone
from sqlalchemy import select, text
from database import SessionLocal, engine, Base
from models import Compound

RANDOM_SEED = 42
SEED_COUNT = 250
SEED_TIMESTAMP = datetime(2026, 1, 1, tzinfo=timezone.utc)

CATEGORIES = [
    "Antiviral", "Kinase Inhibitor", "Antibiotic",
    "Antifungal", "Anticancer", "Anti-inflammatory", "CNS Agent"
]

ELEMENTS = ["C", "H", "N", "O", "S", "Cl", "F"]


def random_formula(rng):
    formula = ""
    for el in rng.sample(ELEMENTS, k=rng.randint(3, 6)):
        formula += f"{el}{rng.randint(1, 22)}"
    return formula


def generate_compound(index: int, rng):
    return Compound(
        name=f"CMP-{index + 1:04d}",
        molecular_formula=random_formula(rng),
        molecular_weight=round(rng.uniform(50, 800), 2),
        solubility=round(rng.uniform(0.001, 100), 3),
        toxicity_score=round(rng.uniform(0, 10), 2),
        binding_affinity=round(rng.uniform(0.5, 500), 2),
        category=rng.choice(CATEGORIES),
        created_at=SEED_TIMESTAMP,
    )


def seed(n=SEED_COUNT, session_factory=SessionLocal):
    rng = random.Random(RANDOM_SEED)
    fixture = [generate_compound(index, rng) for index in range(n)]
    with session_factory.begin() as db:
        dialect = db.get_bind().dialect.name
        if dialect == "postgresql":
            # Serialize seeders and concurrent table writes while deciding what is missing.
            db.execute(text("LOCK TABLE compounds IN SHARE ROW EXCLUSIVE MODE"))
        elif dialect == "sqlite":
            db.execute(text("BEGIN IMMEDIATE"))
        else:
            raise ValueError("The compound fixture supports PostgreSQL and SQLite.")
        existing = set(db.scalars(select(Compound.name)))
        missing = [compound for compound in fixture if compound.name not in existing]
        db.add_all(missing)
    return len(missing)


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    inserted = seed()
    print(f"Inserted {inserted} missing synthetic compounds.")
