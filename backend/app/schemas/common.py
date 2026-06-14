from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedOut(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int
