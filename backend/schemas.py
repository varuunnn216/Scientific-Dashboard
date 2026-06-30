from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class CompoundBase(BaseModel):
    name: str
    molecular_formula: str
    molecular_weight: float
    solubility: float
    toxicity_score: float
    binding_affinity: float
    category: str


class CompoundCreate(CompoundBase):
    pass


class CompoundResponse(CompoundBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class PaginatedCompounds(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[CompoundResponse]


class CategoryStat(BaseModel):
    category: str
    avg_molecular_weight: float
    avg_toxicity_score: float
    avg_binding_affinity: float
    count: int


class StatsResponse(BaseModel):
    total_compounds: int
    categories: List[CategoryStat]
    molecular_weight_distribution: List[dict]  # [{"bucket": "0-100", "count": 12}, ...]
