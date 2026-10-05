import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base


class BaseRepository[ModelT: Base]:
    model: type[ModelT]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, entity_id: uuid.UUID) -> ModelT | None:
        return await self.session.get(self.model, entity_id)

    async def list(
        self,
        filters: Sequence[ColumnElement[bool]],
        skip: int,
        limit: int,
        order_by: Sequence[Any] = (),
    ) -> tuple[list[ModelT], int]:
        query = select(self.model).where(*filters)
        total = await self.session.scalar(select(func.count()).select_from(query.subquery()))
        rows = await self.session.scalars(query.order_by(*order_by).offset(skip).limit(limit))
        return list(rows), total or 0

    async def add(self, entity: ModelT) -> ModelT:
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def save(self, entity: ModelT) -> ModelT:
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def commit(self) -> None:
        await self.session.commit()

    async def delete(self, entity: ModelT) -> None:
        await self.session.delete(entity)
        await self.session.commit()
