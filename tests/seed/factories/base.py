from __future__ import annotations

from typing import Any

from factory.alchemy import SQLAlchemyModelFactory
from sqlalchemy.ext.asyncio import AsyncSession


class BaseFactory(SQLAlchemyModelFactory):
    class Meta:
        abstract = True
        sqlalchemy_session_persistence = "commit"


def bind_factory_session(
    session: AsyncSession, *factory_classes: type[BaseFactory]
) -> None:
    for factory_class in factory_classes:
        factory_class._meta.sqlalchemy_session = None  # type: ignore[attr-defined]


async def create_factory_model(
    session: AsyncSession,
    factory_class: type[BaseFactory],
    **kwargs: Any,
) -> Any:
    instance = factory_class.build(**kwargs)
    session.add(instance)
    await session.commit()
    await session.refresh(instance)
    return instance
