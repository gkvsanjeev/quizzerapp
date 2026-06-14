import os
from pathlib import Path

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import get_async_session
from app.main import app
from app.models.base import Base

# Load .env so TEST_DATABASE_URL is available via os.getenv
load_dotenv(Path(__file__).parents[1] / ".env")

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set — skipping DB tests")

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Drop and recreate tables for a clean slate every test session
    async with engine.begin() as conn:
        try:
            await conn.execute(
                __import__("sqlalchemy").text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
            )
            await conn.execute(
                __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector")
            )
        except Exception:
            pass
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncSession:
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_async_session] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as c:
        yield c
    app.dependency_overrides.clear()
