"""Encyclopedia schemas for TutorQuant."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ModelEntry(BaseModel):
    """A single model encyclopedia entry."""

    id: str
    name: str
    category: str
    formula: str
    process: str
    assumptions: list[str]
    suitable_instruments: list[str]
    strengths: list[str]
    weaknesses: list[str]
    calibration_burden: str
    computational_cost: str
    desk_usage: str
    failure_modes: list[str]
    fragility_warning: str


class EncyclopediaResponse(BaseModel):
    """Full encyclopedia response."""

    models: list[ModelEntry]
    total: int


class CategoryInfo(BaseModel):
    """Category metadata."""

    id: str
    label: str
    count: int


class CategoriesResponse(BaseModel):
    """Available model categories."""

    categories: list[CategoryInfo]
