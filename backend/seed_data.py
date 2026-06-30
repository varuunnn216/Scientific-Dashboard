"""
Run this once to populate the database with realistic fake compound data.
Usage: python seed_data.py
"""
import random
from faker import Faker
from database import SessionLocal, engine, Base
from models import Compound

fake = Faker()
Base.metadata.create_all(bind=engine)

CATEGORIES = [
    "Antiviral", "Kinase Inhibitor", "Antibiotic",
    "Antifungal", "Anticancer", "Anti-inflammatory", "CNS Agent"
]

ELEMENTS = ["C", "H", "N", "O", "S", "Cl", "F"]


def random_formula():
    formula = ""
    for el in random.sample(ELEMENTS, k=random.randint(3, 6)):
        formula += f"{el}{random.randint(1, 22)}"
    return formula


def generate_compound():
    return Compound(
        name=f"{fake.word().capitalize()}-{random.randint(100, 999)}",
        molecular_formula=random_formula(),
        molecular_weight=round(random.uniform(50, 800), 2),
        solubility=round(random.uniform(0.001, 100), 3),
        toxicity_score=round(random.uniform(0, 10), 2),
        binding_affinity=round(random.uniform(0.5, 500), 2),
        category=random.choice(CATEGORIES),
    )


def seed(n=250):
    db = SessionLocal()
    try:
        compounds = [generate_compound() for _ in range(n)]
        db.bulk_save_objects(compounds)
        db.commit()
        print(f"Seeded {n} compounds successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed(250)
