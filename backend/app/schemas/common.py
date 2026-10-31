from decimal import Decimal, ROUND_HALF_UP
from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str
    type: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
    code: str
    fields: Optional[List[ErrorDetail]] = None


def round_half_up(value: Decimal | float | int) -> int:
    """Round to nearest integer using ROUND_HALF_UP, returning integer paise."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
