from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from models import Compound
from seed_data import SEED_COUNT, seed


def test_seed_is_repeatable_and_preserves_existing_rows(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'seed.sqlite'}")
    Compound.__table__.create(engine)
    sessions = sessionmaker(bind=engine)
    assert seed(session_factory=sessions) == SEED_COUNT

    with sessions.begin() as db:
        first = db.scalar(select(Compound).where(Compound.name == "CMP-0001"))
        assert first.binding_affinity == 43.93
        first.name = "Manually curated row"
        second = db.scalar(select(Compound).where(Compound.name == "CMP-0002"))
        second.solubility = 123

    assert seed(session_factory=sessions) == 1
    assert seed(session_factory=sessions) == 0
    with sessions() as db:
        rows = {row.name: row for row in db.scalars(select(Compound))}
        assert len(rows) == SEED_COUNT + 1
        assert rows["CMP-0001"].binding_affinity == rows["Manually curated row"].binding_affinity
        assert rows["CMP-0001"].created_at == rows["Manually curated row"].created_at
        assert rows["CMP-0002"].solubility == 123
