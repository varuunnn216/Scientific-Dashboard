from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class Compound(Base):
    __tablename__ = "compounds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    molecular_formula = Column(String, nullable=False)
    molecular_weight = Column(Float, nullable=False)      # g/mol
    solubility = Column(Float, nullable=False)             # mg/mL
    toxicity_score = Column(Float, nullable=False)         # 0-10 scale
    binding_affinity = Column(Float, nullable=False)       # nM (lower = stronger binder)
    category = Column(String, index=True, nullable=False)  # e.g. "Antiviral", "Kinase Inhibitor"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
