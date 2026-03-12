"""Model encyclopedia router.

Serves structured model metadata for the encyclopedia page.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from engine.encyclopedia import (
    get_encyclopedia,
    get_encyclopedia_by_category,
    get_model_detail,
    get_categories,
)
from schemas.encyclopedia import (
    ModelEntry,
    EncyclopediaResponse,
    CategoriesResponse,
    CategoryInfo,
)

router = APIRouter(prefix="/api/encyclopedia", tags=["Encyclopedia"])


@router.get("/models", response_model=EncyclopediaResponse)
async def list_models(category: Optional[str] = None) -> EncyclopediaResponse:
    """List all models or filter by category."""
    if category:
        models = get_encyclopedia_by_category(category)
    else:
        models = get_encyclopedia()

    return EncyclopediaResponse(
        models=[ModelEntry(**m) for m in models],
        total=len(models),
    )


@router.get("/models/{model_id}", response_model=ModelEntry)
async def get_model(model_id: str) -> ModelEntry:
    """Get detailed info for a single model."""
    model = get_model_detail(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return ModelEntry(**model)


@router.get("/categories", response_model=CategoriesResponse)
async def list_categories() -> CategoriesResponse:
    """List available model categories with counts."""
    cats = get_categories()
    return CategoriesResponse(
        categories=[CategoryInfo(**c) for c in cats]
    )
