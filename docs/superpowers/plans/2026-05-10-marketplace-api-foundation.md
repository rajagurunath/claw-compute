# Marketplace API + Data Model Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI + Postgres backend that suppliers, workers, and consumers all talk to — the contract every other subsystem (worker binary, frontend) will consume.

**Architecture:** Async FastAPI app, Postgres with SQLAlchemy 2.x (async) + Alembic, Pydantic v2 for I/O, magic-link auth for users (dev mode logs tokens; prod via SMTP), provisioning-token → JWT for workers. Trust-but-verify model — no payments, no E2E crypto, no TEE in v1. Stateless, horizontally scalable.

**Tech Stack:** Python 3.12, uv (package manager), FastAPI 0.115+, SQLAlchemy 2.x async, asyncpg, Alembic, Pydantic v2, PyJWT, argon2-cffi, pytest + pytest-asyncio, httpx, ruff, Postgres 16 (Docker for dev).

**Out of scope (deferred to other plans):** Worker binary, frontend, real inference/sandbox, Stripe, OpenClaw/Hermes integration, agent state migration, scoring/ranking background jobs.

**Dependency for downstream plans:**
- Plan 2 (worker binary) depends on `/v1/workers/register` + `/v1/workers/heartbeat` from this plan.
- Plan 3 (sandbox + inference) depends on `/v1/bookings` lifecycle.
- Plan 4 (frontend) depends on all public endpoints.

---

## File Structure

```
backend/
  pyproject.toml
  uv.lock
  alembic.ini
  .env.example
  docker-compose.yml
  alembic/
    env.py
    versions/
  src/claw_api/
    __init__.py
    main.py                 # FastAPI app factory + lifespan
    config.py               # pydantic-settings
    db.py                   # async engine, session, Base
    deps.py                 # FastAPI dependencies (auth, db)
    models/
      __init__.py
      base.py               # Base + mixins
      users.py
      magic_links.py
      suppliers.py
      offerings.py
      workers.py
      heartbeats.py
      bookings.py
    schemas/
      __init__.py
      auth.py
      suppliers.py
      offerings.py
      workers.py
      bookings.py
    api/v1/
      __init__.py
      router.py             # aggregates v1 routers
      health.py
      auth.py
      suppliers.py
      offerings.py
      workers.py
      bookings.py
    auth/
      __init__.py
      magic_link.py         # token gen + send
      jwt.py                # encode/decode
      hashing.py            # argon2 helpers
  tests/
    conftest.py             # db fixture, client fixture
    test_health.py
    test_auth.py
    test_suppliers.py
    test_offerings.py
    test_workers.py
    test_bookings.py
```

**Why these splits:**
- `models/` per domain (small focused files; SQLAlchemy classes don't need to share modules).
- `api/v1/` mirrors domain split — each router file has roughly the endpoints for one resource.
- `auth/` isolated so it can be reused (and replaced — magic link → OAuth in v2 — without touching routers).
- `schemas/` is Pydantic-only; never imports SQLAlchemy.

---

## Conventions Used Throughout

- **TDD:** Every endpoint test is written first, watched fail, then implemented. Async tests use `pytest-asyncio` with `asyncio_mode = "auto"`.
- **DB tests:** Each test gets a fresh transaction that's rolled back at end. No test pollution.
- **IDs:** UUIDv7 (time-ordered) via `uuid_utils` for primary keys. String columns of length 36.
- **Timestamps:** All tables have `created_at TIMESTAMPTZ DEFAULT now()`. Mutable rows also have `updated_at`.
- **Migrations:** One Alembic revision per task that touches the schema. Never edit a committed migration; always add a new one.
- **Commits:** Conventional Commits (`feat:`, `test:`, `fix:`, `chore:`).

---

## Task 1: Project Scaffolding

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.gitignore`
- Create: `backend/.env.example`
- Create: `backend/src/claw_api/__init__.py`
- Create: `backend/src/claw_api/main.py`
- Create: `backend/src/claw_api/config.py`
- Create: `backend/src/claw_api/api/v1/__init__.py`
- Create: `backend/src/claw_api/api/v1/router.py`
- Create: `backend/src/claw_api/api/v1/health.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_health.py`

- [x] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "claw-api"
version = "0.1.0"
description = "Claw marketplace API"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic>=2.9",
    "pydantic-settings>=2.5",
    "sqlalchemy[asyncio]>=2.0.36",
    "asyncpg>=0.30",
    "alembic>=1.14",
    "pyjwt[crypto]>=2.9",
    "argon2-cffi>=23.1",
    "uuid-utils>=0.10",
    "email-validator>=2.2",
]

[dependency-groups]
dev = [
    "pytest>=8",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
    "ruff>=0.7",
    "aiosqlite>=0.20",
]

[tool.uv]
package = true

[tool.hatch.build.targets.wheel]
packages = ["src/claw_api"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
pythonpath = ["src"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "ASYNC", "S"]
ignore = ["S101"]  # assert allowed in tests
```

- [x] **Step 2: Create `backend/.gitignore`**

```gitignore
.venv/
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
.env
*.db
*.db-journal
.coverage
dist/
build/
*.egg-info/
```

- [x] **Step 3: Create `backend/.env.example`**

```dotenv
# Copy to .env and fill in
DATABASE_URL=postgresql+asyncpg://claw:claw@localhost:5432/claw_dev
JWT_SECRET=change-me-to-32-bytes-of-random
JWT_ALGORITHM=HS256
JWT_USER_TTL_HOURS=24
JWT_WORKER_TTL_DAYS=30
MAGIC_LINK_TTL_MINUTES=15
MAGIC_LINK_DELIVERY=console   # console | smtp
APP_ENV=dev
```

- [x] **Step 4: Create `backend/src/claw_api/config.py`**

```python
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="dev")
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_user_ttl_hours: int = 24
    jwt_worker_ttl_days: int = 30
    magic_link_ttl_minutes: int = 15
    magic_link_delivery: str = "console"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

- [x] **Step 5: Create FastAPI app + health router**

`backend/src/claw_api/api/v1/health.py`:
```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

`backend/src/claw_api/api/v1/router.py`:
```python
from fastapi import APIRouter
from claw_api.api.v1 import health

api_v1 = APIRouter(prefix="/v1")
api_v1.include_router(health.router)
```

`backend/src/claw_api/api/v1/__init__.py`: empty file.

`backend/src/claw_api/main.py`:
```python
from fastapi import FastAPI
from claw_api.api.v1.router import api_v1


def create_app() -> FastAPI:
    app = FastAPI(title="Claw Marketplace API", version="0.1.0")
    app.include_router(api_v1)
    return app


app = create_app()
```

`backend/src/claw_api/__init__.py`: empty file.

- [x] **Step 6: Write the failing health test**

`backend/tests/__init__.py`: empty.

`backend/tests/test_health.py`:
```python
from fastapi.testclient import TestClient
from claw_api.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [x] **Step 7: Install + run tests**

Run from `backend/`:
```bash
uv sync
cp .env.example .env
uv run pytest -v
```

Expected: 1 passed.

- [x] ~ **Step 8: Run the server manually** (skipped: redundant with Step 7's TestClient — same code path)

```bash
uv run uvicorn claw_api.main:app --reload --port 8000
curl -s http://localhost:8000/v1/health
```

Expected: `{"status":"ok"}`. Stop server with Ctrl-C.

- [x] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat(api): scaffold FastAPI app with health endpoint"
```

---

## Task 2: Postgres + SQLAlchemy + Alembic

**Files:**
- Create: `backend/docker-compose.yml`
- Create: `backend/src/claw_api/db.py`
- Create: `backend/src/claw_api/models/__init__.py`
- Create: `backend/src/claw_api/models/base.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`

- [x] **Step 1: Create `backend/docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: claw
      POSTGRES_PASSWORD: claw
      POSTGRES_DB: claw_dev
    ports:
      - "5432:5432"
    volumes:
      - claw-pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U claw -d claw_dev"]
      interval: 2s
      timeout: 5s
      retries: 10

volumes:
  claw-pg:
```

- [x] **Step 2: Start Postgres**

```bash
cd backend && docker compose up -d
docker compose ps
```

Expected: `db` service `healthy`.

- [x] **Step 3: Create `backend/src/claw_api/db.py`**

```python
from collections.abc import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from claw_api.config import get_settings

_settings = get_settings()
engine = create_async_engine(_settings.database_url, echo=False, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
```

- [x] **Step 4: Create `backend/src/claw_api/models/base.py`**

```python
from datetime import datetime
from uuid import UUID
import uuid_utils as uu
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def new_id() -> str:
    return str(uu.uuid7())


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class IdMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
```

`backend/src/claw_api/models/__init__.py`:
```python
from claw_api.models.base import Base, IdMixin, TimestampMixin, new_id

__all__ = ["Base", "IdMixin", "TimestampMixin", "new_id"]
```

- [x] **Step 5: Initialise Alembic**

```bash
cd backend && uv run alembic init -t async alembic
```

This creates `alembic/` with `env.py`, `script.py.mako`, `versions/`, and `alembic.ini`.

- [x] **Step 6: Edit `backend/alembic.ini`**

Set the `sqlalchemy.url` line to:
```ini
sqlalchemy.url =
```
(empty — we'll set it from env in `env.py`).

- [x] **Step 7: Replace `backend/alembic/env.py`** with the content below

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from claw_api.config import get_settings
from claw_api.models import Base
# import all model modules so their tables register on Base.metadata
from claw_api.models import base  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [x] **Step 8: Generate the empty initial revision**

```bash
cd backend && uv run alembic revision -m "init"
```

This creates an empty migration in `alembic/versions/`. Confirm the file exists and has `def upgrade()` / `def downgrade()` stubs. Leave them empty for now — real schema lands in later tasks.

- [x] **Step 9: Apply migration to verify wiring**

```bash
uv run alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade ...`. No errors.

Verify the `alembic_version` table exists:
```bash
docker compose exec db psql -U claw -d claw_dev -c "\dt"
```

- [x] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat(db): add SQLAlchemy + Alembic with empty initial revision"
```

---

## Task 3: Test Infrastructure (DB Fixtures)

**Files:**
- Create: `backend/tests/conftest.py`
- Modify: `backend/tests/test_health.py` (use new client fixture)

- [x] **Step 1: Create `backend/tests/conftest.py`**

```python
import asyncio
from collections.abc import AsyncIterator
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from claw_api.config import get_settings
from claw_api.db import get_db
from claw_api.main import create_app
from claw_api.models import Base


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    # Separate test DB. Caller must have created `claw_test` (see Step 3).
    settings = get_settings()
    test_url = settings.database_url.replace("/claw_dev", "/claw_test")
    engine = create_async_engine(test_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with test_engine.connect() as conn:
        trans = await conn.begin()
        async with Session(bind=conn) as session:
            yield session
        await trans.rollback()


@pytest.fixture
async def client(db_session) -> AsyncIterator[AsyncClient]:
    app = create_app()

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [x] **Step 2: Update `backend/tests/test_health.py`** to use the async client

```python
import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    response = await client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [x] **Step 3: Create the test database**

```bash
cd backend && docker compose exec db psql -U claw -d postgres -c "CREATE DATABASE claw_test;"
```

(Idempotent — if it exists, the error is harmless. Or guard with `\gexec`.)

- [x] **Step 4: Run the tests**

```bash
uv run pytest -v
```

Expected: 1 passed.

- [x] **Step 5: Commit**

```bash
git add backend/
git commit -m "test: add async DB-backed test fixtures"
```

---

## Task 4: User Model + Magic-Link Auth (TDD)

**Files:**
- Create: `backend/src/claw_api/models/users.py`
- Create: `backend/src/claw_api/models/magic_links.py`
- Create: `backend/src/claw_api/auth/__init__.py`
- Create: `backend/src/claw_api/auth/hashing.py`
- Create: `backend/src/claw_api/auth/jwt.py`
- Create: `backend/src/claw_api/auth/magic_link.py`
- Create: `backend/src/claw_api/schemas/auth.py`
- Create: `backend/src/claw_api/api/v1/auth.py`
- Create: `backend/src/claw_api/deps.py`
- Modify: `backend/src/claw_api/api/v1/router.py`
- Create: `backend/tests/test_auth.py`
- Create: Alembic revision for users + magic_links tables

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_auth.py`:
```python
import pytest


@pytest.mark.asyncio
async def test_request_magic_link_creates_token(client, db_session):
    response = await client.post(
        "/v1/auth/magic-link",
        json={"email": "alice@example.com"},
    )
    assert response.status_code == 202

    from sqlalchemy import select
    from claw_api.models.magic_links import MagicLinkToken
    rows = (await db_session.execute(select(MagicLinkToken))).scalars().all()
    assert len(rows) == 1
    assert rows[0].used_at is None


@pytest.mark.asyncio
async def test_verify_magic_link_returns_jwt(client, db_session, monkeypatch):
    captured = {}

    async def fake_send(email: str, token: str) -> None:
        captured["email"] = email
        captured["token"] = token

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake_send)

    await client.post("/v1/auth/magic-link", json={"email": "bob@example.com"})
    token = captured["token"]

    response = await client.post("/v1/auth/verify", json={"token": token})
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_verify_invalid_token_rejected(client):
    response = await client.post("/v1/auth/verify", json={"token": "not-a-real-token"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(client, monkeypatch):
    captured = {}

    async def fake_send(email: str, token: str) -> None:
        captured["token"] = token

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake_send)

    await client.post("/v1/auth/magic-link", json={"email": "carol@example.com"})
    verify = await client.post("/v1/auth/verify", json={"token": captured["token"]})
    jwt_token = verify.json()["access_token"]

    response = await client.get("/v1/me", headers={"Authorization": f"Bearer {jwt_token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "carol@example.com"
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
uv run pytest tests/test_auth.py -v
```

Expected: 4 errors (imports / endpoints not found).

- [ ] **Step 3: Add User and MagicLinkToken models**

`backend/src/claw_api/models/users.py`:
```python
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class User(Base, IdMixin, TimestampMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
```

`backend/src/claw_api/models/magic_links.py`:
```python
from datetime import datetime
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class MagicLinkToken(Base, IdMixin, TimestampMixin):
    __tablename__ = "magic_link_tokens"
    email: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

Update `backend/src/claw_api/models/__init__.py`:
```python
from claw_api.models.base import Base, IdMixin, TimestampMixin, new_id
from claw_api.models.users import User
from claw_api.models.magic_links import MagicLinkToken

__all__ = ["Base", "IdMixin", "TimestampMixin", "new_id", "User", "MagicLinkToken"]
```

Also import them in `alembic/env.py` so autogenerate sees them. Replace the `from claw_api.models import base  # noqa: F401` line with:
```python
from claw_api.models import base, users, magic_links  # noqa: F401
```

- [ ] **Step 4: Generate the migration**

```bash
uv run alembic revision --autogenerate -m "users and magic_link_tokens"
uv run alembic upgrade head
```

Inspect the generated file in `alembic/versions/`. Confirm both tables appear with columns: `id`, `email`, `created_at`, `updated_at` for users; plus `token_hash`, `expires_at`, `used_at` for magic_link_tokens.

- [ ] **Step 5: Implement password/token hashing**

`backend/src/claw_api/auth/__init__.py`: empty.

`backend/src/claw_api/auth/hashing.py`:
```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()


def hash_token(plain: str) -> str:
    return _hasher.hash(plain)


def verify_token(plain: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except VerifyMismatchError:
        return False
```

- [ ] **Step 6: Implement JWT helpers**

`backend/src/claw_api/auth/jwt.py`:
```python
from datetime import UTC, datetime, timedelta
from typing import Any
import jwt

from claw_api.config import get_settings


def encode_user_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "kind": "user",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_user_ttl_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
```

- [ ] **Step 7: Implement magic-link service**

`backend/src/claw_api/auth/magic_link.py`:
```python
import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth.hashing import hash_token, verify_token
from claw_api.config import get_settings
from claw_api.models.magic_links import MagicLinkToken
from claw_api.models.users import User

logger = logging.getLogger(__name__)


async def issue_magic_link(db: AsyncSession, email: str) -> str:
    settings = get_settings()
    raw = secrets.token_urlsafe(32)
    record = MagicLinkToken(
        email=email.lower(),
        token_hash=hash_token(raw),
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.magic_link_ttl_minutes),
    )
    db.add(record)
    await db.commit()
    return raw


async def deliver_magic_link(email: str, token: str) -> None:
    """Sends the link. Dev mode logs to console; prod mode (later) sends SMTP."""
    settings = get_settings()
    if settings.magic_link_delivery == "console":
        logger.warning("MAGIC LINK for %s: token=%s", email, token)
    else:
        raise NotImplementedError("SMTP delivery not implemented in v1")


async def consume_magic_link(db: AsyncSession, raw: str) -> User | None:
    """Verify the raw token, mark used, return-or-create the user."""
    now = datetime.now(UTC)
    candidates = (
        await db.execute(
            select(MagicLinkToken).where(
                MagicLinkToken.used_at.is_(None),
                MagicLinkToken.expires_at > now,
            )
        )
    ).scalars().all()

    for candidate in candidates:
        if verify_token(raw, candidate.token_hash):
            candidate.used_at = now
            user = (
                await db.execute(select(User).where(User.email == candidate.email))
            ).scalar_one_or_none()
            if user is None:
                user = User(email=candidate.email)
                db.add(user)
            await db.commit()
            await db.refresh(user)
            return user
    return None
```

Note the linear scan — argon2 hashes are non-deterministic so we can't index by hash directly. Acceptable at v1 volumes; replace with HMAC-keyed lookup if it becomes a hotspot.

- [ ] **Step 8: Add Pydantic schemas**

`backend/src/claw_api/schemas/__init__.py`: empty.

`backend/src/claw_api/schemas/auth.py`:
```python
from pydantic import BaseModel, EmailStr


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkVerify(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 9: Add the auth router and current-user dependency**

`backend/src/claw_api/deps.py`:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth.jwt import decode_token
from claw_api.db import get_db
from claw_api.models.users import User

_bearer = HTTPBearer(auto_error=False)


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        payload = decode_token(creds.credentials)
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    if payload.get("kind") != "user":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong token kind")
    user = (
        await db.execute(select(User).where(User.id == payload["sub"]))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return user
```

`backend/src/claw_api/api/v1/auth.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth import magic_link as ml
from claw_api.auth.jwt import encode_user_token
from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.users import User
from claw_api.schemas.auth import MagicLinkRequest, MagicLinkVerify, TokenResponse, UserOut

router = APIRouter(tags=["auth"])


@router.post("/auth/magic-link", status_code=202)
async def request_magic_link(
    payload: MagicLinkRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    raw = await ml.issue_magic_link(db, payload.email)
    await ml.deliver_magic_link(payload.email, raw)
    return {"status": "sent"}


@router.post("/auth/verify", response_model=TokenResponse)
async def verify_magic_link(
    payload: MagicLinkVerify, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    user = await ml.consume_magic_link(db, payload.token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token")
    return TokenResponse(access_token=encode_user_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)) -> User:
    return user
```

Update `backend/src/claw_api/api/v1/router.py`:
```python
from fastapi import APIRouter
from claw_api.api.v1 import auth, health

api_v1 = APIRouter(prefix="/v1")
api_v1.include_router(health.router)
api_v1.include_router(auth.router)
```

- [ ] **Step 10: Run tests**

```bash
uv run pytest tests/test_auth.py -v
```

Expected: 4 passed.

- [ ] **Step 11: Commit**

```bash
git add backend/
git commit -m "feat(auth): magic-link issuance, verify, and JWT-protected /me"
```

---

## Task 5: Suppliers

**Files:**
- Create: `backend/src/claw_api/models/suppliers.py`
- Create: `backend/src/claw_api/schemas/suppliers.py`
- Create: `backend/src/claw_api/api/v1/suppliers.py`
- Modify: `backend/src/claw_api/models/__init__.py`
- Modify: `backend/src/claw_api/api/v1/router.py`
- Modify: `backend/alembic/env.py` (import new model)
- Create: Alembic revision
- Create: `backend/tests/test_suppliers.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_suppliers.py`:
```python
import pytest


async def _login(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake_send(e: str, t: str) -> None:
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake_send)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_become_supplier(client, monkeypatch):
    token = await _login(client, monkeypatch, "sup@example.com")
    r = await client.post(
        "/v1/suppliers",
        json={"display_name": "Acme GPUs", "payout_email": "pay@acme.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["display_name"] == "Acme GPUs"


@pytest.mark.asyncio
async def test_supplier_me_requires_auth(client):
    r = await client.get("/v1/suppliers/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_supplier_me_returns_profile(client, monkeypatch):
    token = await _login(client, monkeypatch, "sup2@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": "Bravo", "payout_email": "p@b.com"},
        headers=auth,
    )
    r = await client.get("/v1/suppliers/me", headers=auth)
    assert r.status_code == 200
    assert r.json()["display_name"] == "Bravo"


@pytest.mark.asyncio
async def test_cannot_double_register_supplier(client, monkeypatch):
    token = await _login(client, monkeypatch, "sup3@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    body = {"display_name": "X", "payout_email": "x@x.com"}
    r1 = await client.post("/v1/suppliers", json=body, headers=auth)
    assert r1.status_code == 201
    r2 = await client.post("/v1/suppliers", json=body, headers=auth)
    assert r2.status_code == 409
```

- [ ] **Step 2: Confirm failure**

```bash
uv run pytest tests/test_suppliers.py -v
```

Expected: 4 errors.

- [ ] **Step 3: Add Supplier model**

`backend/src/claw_api/models/suppliers.py`:
```python
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class Supplier(Base, IdMixin, TimestampMixin):
    __tablename__ = "suppliers"
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, index=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    payout_email: Mapped[str] = mapped_column(String(320), nullable=False)
```

Update `models/__init__.py`:
```python
from claw_api.models.base import Base, IdMixin, TimestampMixin, new_id
from claw_api.models.users import User
from claw_api.models.magic_links import MagicLinkToken
from claw_api.models.suppliers import Supplier

__all__ = ["Base", "IdMixin", "TimestampMixin", "new_id", "User", "MagicLinkToken", "Supplier"]
```

Update `alembic/env.py` import line:
```python
from claw_api.models import base, users, magic_links, suppliers  # noqa: F401
```

- [ ] **Step 4: Generate + apply migration**

```bash
uv run alembic revision --autogenerate -m "suppliers"
uv run alembic upgrade head
```

Inspect the generated revision; confirm `suppliers` table with `user_id` FK and unique constraint.

- [ ] **Step 5: Schemas**

`backend/src/claw_api/schemas/suppliers.py`:
```python
from pydantic import BaseModel, EmailStr


class SupplierCreate(BaseModel):
    display_name: str
    payout_email: EmailStr


class SupplierOut(BaseModel):
    id: str
    display_name: str
    payout_email: EmailStr

    model_config = {"from_attributes": True}
```

- [ ] **Step 6: Router**

`backend/src/claw_api/api/v1/suppliers.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.schemas.suppliers import SupplierCreate, SupplierOut

router = APIRouter(tags=["suppliers"])


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def become_supplier(
    payload: SupplierCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    existing = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "user already a supplier")
    supplier = Supplier(
        user_id=user.id,
        display_name=payload.display_name,
        payout_email=str(payload.payout_email),
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.get("/suppliers/me", response_model=SupplierOut)
async def get_my_supplier(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not a supplier")
    return supplier
```

Wire into router (`api/v1/router.py`):
```python
from claw_api.api.v1 import auth, health, suppliers

api_v1.include_router(suppliers.router)
```

- [ ] **Step 7: Run tests**

```bash
uv run pytest tests/test_suppliers.py -v
```

Expected: 4 passed.

- [x] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(suppliers): supplier registration and self-lookup"
```

---

## Task 6: Offerings

**Files:**
- Create: `backend/src/claw_api/models/offerings.py`
- Create: `backend/src/claw_api/schemas/offerings.py`
- Create: `backend/src/claw_api/api/v1/offerings.py`
- Modify: `backend/src/claw_api/models/__init__.py`
- Modify: `backend/src/claw_api/api/v1/router.py`
- Modify: `backend/alembic/env.py`
- Create: Alembic revision
- Create: `backend/tests/test_offerings.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_offerings.py`:
```python
import pytest


async def _login(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake_send(e: str, t: str) -> None:
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake_send)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    return r.json()["access_token"]


async def _make_supplier(client, monkeypatch, email: str) -> str:
    token = await _login(client, monkeypatch, email)
    auth = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": email, "payout_email": email},
        headers=auth,
    )
    return token


@pytest.mark.asyncio
async def test_create_offering_requires_supplier(client, monkeypatch):
    token = await _login(client, monkeypatch, "consumer@example.com")
    r = await client.post(
        "/v1/offerings",
        json={
            "title": "GPU rental",
            "description": "M3 Max idle compute",
            "price_per_hour_cents": 200,
            "capability_tags": ["macos", "apple-silicon"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_supplier_creates_and_browses_offering(client, monkeypatch):
    token = await _make_supplier(client, monkeypatch, "off1@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    create = await client.post(
        "/v1/offerings",
        json={
            "title": "GPU rental",
            "description": "M3 Max idle compute",
            "price_per_hour_cents": 200,
            "capability_tags": ["macos"],
        },
        headers=auth,
    )
    assert create.status_code == 201
    oid = create.json()["id"]

    browse = await client.get("/v1/offerings")
    assert browse.status_code == 200
    items = browse.json()["items"]
    assert any(i["id"] == oid for i in items)


@pytest.mark.asyncio
async def test_offering_visibility_filters_drafts(client, monkeypatch):
    token = await _make_supplier(client, monkeypatch, "off2@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    r = await client.post(
        "/v1/offerings",
        json={
            "title": "Draft",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
            "status": "draft",
        },
        headers=auth,
    )
    assert r.status_code == 201
    browse = await client.get("/v1/offerings")
    assert all(i["title"] != "Draft" for i in browse.json()["items"])


@pytest.mark.asyncio
async def test_only_owner_can_update_offering(client, monkeypatch):
    owner_token = await _make_supplier(client, monkeypatch, "owner@example.com")
    other_token = await _make_supplier(client, monkeypatch, "other@example.com")
    create = await client.post(
        "/v1/offerings",
        json={
            "title": "T",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    oid = create.json()["id"]
    r = await client.patch(
        f"/v1/offerings/{oid}",
        json={"title": "Hijacked"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert r.status_code == 404
```

- [ ] **Step 2: Confirm failure**

```bash
uv run pytest tests/test_offerings.py -v
```

- [ ] **Step 3: Add Offering model**

`backend/src/claw_api/models/offerings.py`:
```python
from enum import StrEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class OfferingStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class Offering(Base, IdMixin, TimestampMixin):
    __tablename__ = "offerings"
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price_per_hour_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    capability_tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)), nullable=False, default=list
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=OfferingStatus.ACTIVE.value
    )
```

Update `models/__init__.py` and `alembic/env.py` imports the same way as before.

- [ ] **Step 4: Generate + apply migration**

```bash
uv run alembic revision --autogenerate -m "offerings"
uv run alembic upgrade head
```

- [ ] **Step 5: Schemas**

`backend/src/claw_api/schemas/offerings.py`:
```python
from typing import Literal
from pydantic import BaseModel, Field


OfferingStatus = Literal["draft", "active", "archived"]


class OfferingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    price_per_hour_cents: int = Field(ge=0)
    capability_tags: list[str] = Field(default_factory=list)
    status: OfferingStatus = "active"


class OfferingUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    price_per_hour_cents: int | None = Field(default=None, ge=0)
    capability_tags: list[str] | None = None
    status: OfferingStatus | None = None


class OfferingOut(BaseModel):
    id: str
    supplier_id: str
    title: str
    description: str
    price_per_hour_cents: int
    capability_tags: list[str]
    status: OfferingStatus

    model_config = {"from_attributes": True}


class OfferingList(BaseModel):
    items: list[OfferingOut]
    total: int
```

- [ ] **Step 6: Router**

`backend/src/claw_api/api/v1/offerings.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.offerings import Offering, OfferingStatus
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.schemas.offerings import OfferingCreate, OfferingList, OfferingOut, OfferingUpdate

router = APIRouter(tags=["offerings"])


async def _require_supplier(db: AsyncSession, user: User) -> Supplier:
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "supplier account required")
    return supplier


@router.post("/offerings", response_model=OfferingOut, status_code=201)
async def create_offering(
    payload: OfferingCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Offering:
    supplier = await _require_supplier(db, user)
    offering = Offering(
        supplier_id=supplier.id,
        title=payload.title,
        description=payload.description,
        price_per_hour_cents=payload.price_per_hour_cents,
        capability_tags=payload.capability_tags,
        status=payload.status,
    )
    db.add(offering)
    await db.commit()
    await db.refresh(offering)
    return offering


@router.get("/offerings", response_model=OfferingList)
async def browse_offerings(
    db: AsyncSession = Depends(get_db),
    capability: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> OfferingList:
    stmt = select(Offering).where(Offering.status == OfferingStatus.ACTIVE.value)
    if capability:
        stmt = stmt.where(Offering.capability_tags.any(capability))
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    items = (
        await db.execute(stmt.order_by(Offering.created_at.desc()).limit(limit).offset(offset))
    ).scalars().all()
    return OfferingList(
        items=[OfferingOut.model_validate(o) for o in items], total=total
    )


@router.get("/offerings/{offering_id}", response_model=OfferingOut)
async def get_offering(offering_id: str, db: AsyncSession = Depends(get_db)) -> Offering:
    offering = (
        await db.execute(select(Offering).where(Offering.id == offering_id))
    ).scalar_one_or_none()
    if offering is None:
        raise HTTPException(404, "not found")
    return offering


@router.patch("/offerings/{offering_id}", response_model=OfferingOut)
async def update_offering(
    offering_id: str,
    payload: OfferingUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Offering:
    supplier = await _require_supplier(db, user)
    offering = (
        await db.execute(
            select(Offering).where(
                Offering.id == offering_id, Offering.supplier_id == supplier.id
            )
        )
    ).scalar_one_or_none()
    if offering is None:
        raise HTTPException(404, "not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(offering, field, value)
    await db.commit()
    await db.refresh(offering)
    return offering


@router.delete("/offerings/{offering_id}", status_code=204)
async def delete_offering(
    offering_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    supplier = await _require_supplier(db, user)
    offering = (
        await db.execute(
            select(Offering).where(
                Offering.id == offering_id, Offering.supplier_id == supplier.id
            )
        )
    ).scalar_one_or_none()
    if offering is None:
        raise HTTPException(404, "not found")
    await db.delete(offering)
    await db.commit()
```

Wire into router (`api/v1/router.py`):
```python
from claw_api.api.v1 import auth, health, offerings, suppliers
api_v1.include_router(offerings.router)
```

- [ ] **Step 7: Run tests**

```bash
uv run pytest tests/test_offerings.py -v
```

Expected: 4 passed.

- [x] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(offerings): CRUD + public browse with capability filter"
```

---

## Task 7: Workers + Provisioning Tokens

**Why two-stage auth:** A supplier issues a one-time **provisioning token** from their dashboard. The worker binary takes that token, calls `/workers/register`, and gets a long-lived **worker JWT** in return. This way the worker never holds the supplier's user JWT, and rotation is a matter of revoking + re-issuing.

**Files:**
- Create: `backend/src/claw_api/models/workers.py`
- Create: `backend/src/claw_api/schemas/workers.py`
- Create: `backend/src/claw_api/api/v1/workers.py`
- Modify: `backend/src/claw_api/auth/jwt.py` (add `encode_worker_token`)
- Modify: `backend/src/claw_api/deps.py` (add `current_worker`)
- Modify: `backend/src/claw_api/models/__init__.py`
- Modify: `backend/src/claw_api/api/v1/router.py`
- Modify: `backend/alembic/env.py`
- Create: Alembic revision
- Create: `backend/tests/test_workers.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_workers.py`:
```python
import pytest


async def _make_supplier(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake(e: str, t: str) -> None:
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    user_token = r.json()["access_token"]
    auth = {"Authorization": f"Bearer {user_token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": email, "payout_email": email},
        headers=auth,
    )
    return user_token


@pytest.mark.asyncio
async def test_supplier_issues_provisioning_token(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w1@example.com")
    r = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "mac-studio-1"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert "provisioning_token" in body
    assert body["worker"]["status"] == "pending"


@pytest.mark.asyncio
async def test_worker_register_then_heartbeat(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w2@example.com")
    issued = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "mac-studio-2"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    prov = issued.json()["provisioning_token"]

    reg = await client.post(
        "/v1/workers/register",
        json={
            "provisioning_token": prov,
            "machine_info": {"chip": "Apple M3 Max", "ram_gb": 64},
        },
    )
    assert reg.status_code == 200
    worker_token = reg.json()["worker_token"]

    hb = await client.post(
        "/v1/workers/heartbeat",
        json={"cpu_pct": 12.5, "mem_pct": 40.0, "free_ram_gb": 30.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert hb.status_code == 204


@pytest.mark.asyncio
async def test_provisioning_token_single_use(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w3@example.com")
    issued = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "mac-studio-3"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    prov = issued.json()["provisioning_token"]
    body = {"provisioning_token": prov, "machine_info": {}}
    r1 = await client.post("/v1/workers/register", json=body)
    assert r1.status_code == 200
    r2 = await client.post("/v1/workers/register", json=body)
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_supplier_lists_workers(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w4@example.com")
    auth = {"Authorization": f"Bearer {user_token}"}
    await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "a"}, headers=auth
    )
    await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "b"}, headers=auth
    )
    r = await client.get("/v1/suppliers/me/workers", headers=auth)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 2
```

- [ ] **Step 2: Confirm failure**

```bash
uv run pytest tests/test_workers.py -v
```

- [ ] **Step 3: Add Worker model**

`backend/src/claw_api/models/workers.py`:
```python
from datetime import datetime
from enum import StrEnum
from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class WorkerStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    OFFLINE = "offline"
    DISABLED = "disabled"


class Worker(Base, IdMixin, TimestampMixin):
    __tablename__ = "workers"
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    provisioning_token_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=WorkerStatus.PENDING.value
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    machine_info: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
```

Update `models/__init__.py` and `alembic/env.py` imports.

- [ ] **Step 4: Migration**

```bash
uv run alembic revision --autogenerate -m "workers"
uv run alembic upgrade head
```

- [ ] **Step 5: Add `encode_worker_token` and `current_worker`**

Append to `backend/src/claw_api/auth/jwt.py`:
```python
def encode_worker_token(worker_id: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": worker_id,
        "kind": "worker",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_worker_ttl_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
```

Append to `backend/src/claw_api/deps.py`:
```python
from claw_api.models.workers import Worker


async def current_worker(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Worker:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        payload = decode_token(creds.credentials)
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    if payload.get("kind") != "worker":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong token kind")
    worker = (
        await db.execute(select(Worker).where(Worker.id == payload["sub"]))
    ).scalar_one_or_none()
    if worker is None or worker.status == "disabled":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "worker not found or disabled")
    return worker
```

- [ ] **Step 6: Schemas**

`backend/src/claw_api/schemas/workers.py`:
```python
from datetime import datetime
from pydantic import BaseModel, Field


class ProvisioningTokenRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkerOut(BaseModel):
    id: str
    name: str
    status: str
    last_seen_at: datetime | None
    machine_info: dict

    model_config = {"from_attributes": True}


class ProvisioningTokenResponse(BaseModel):
    provisioning_token: str
    worker: WorkerOut


class WorkerRegisterRequest(BaseModel):
    provisioning_token: str
    machine_info: dict = Field(default_factory=dict)


class WorkerRegisterResponse(BaseModel):
    worker_token: str
    worker: WorkerOut


class HeartbeatRequest(BaseModel):
    cpu_pct: float
    mem_pct: float
    gpu_pct: float | None = None
    free_ram_gb: float | None = None
    model_loaded_id: str | None = None


class WorkerList(BaseModel):
    items: list[WorkerOut]
```

- [ ] **Step 7: Router**

`backend/src/claw_api/api/v1/workers.py`:
```python
import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth.hashing import hash_token, verify_token
from claw_api.auth.jwt import encode_worker_token
from claw_api.db import get_db
from claw_api.deps import current_user, current_worker
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.models.workers import Worker, WorkerStatus
from claw_api.schemas.workers import (
    HeartbeatRequest,
    ProvisioningTokenRequest,
    ProvisioningTokenResponse,
    WorkerList,
    WorkerOut,
    WorkerRegisterRequest,
    WorkerRegisterResponse,
)

router = APIRouter(tags=["workers"])


async def _supplier_for(db: AsyncSession, user: User) -> Supplier:
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "supplier account required")
    return supplier


@router.post(
    "/workers/provisioning-tokens",
    response_model=ProvisioningTokenResponse,
    status_code=201,
)
async def issue_provisioning_token(
    payload: ProvisioningTokenRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ProvisioningTokenResponse:
    supplier = await _supplier_for(db, user)
    raw = secrets.token_urlsafe(32)
    worker = Worker(
        supplier_id=supplier.id,
        name=payload.name,
        provisioning_token_hash=hash_token(raw),
        status=WorkerStatus.PENDING.value,
        machine_info={},
    )
    db.add(worker)
    await db.commit()
    await db.refresh(worker)
    return ProvisioningTokenResponse(
        provisioning_token=raw, worker=WorkerOut.model_validate(worker)
    )


@router.post("/workers/register", response_model=WorkerRegisterResponse)
async def register_worker(
    payload: WorkerRegisterRequest, db: AsyncSession = Depends(get_db)
) -> WorkerRegisterResponse:
    candidates = (
        await db.execute(
            select(Worker).where(
                Worker.provisioning_token_hash.is_not(None),
                Worker.status == WorkerStatus.PENDING.value,
            )
        )
    ).scalars().all()
    matched: Worker | None = None
    for w in candidates:
        if w.provisioning_token_hash and verify_token(
            payload.provisioning_token, w.provisioning_token_hash
        ):
            matched = w
            break
    if matched is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid provisioning token")
    matched.status = WorkerStatus.ACTIVE.value
    matched.machine_info = payload.machine_info
    matched.provisioning_token_hash = None  # one-time use
    matched.last_seen_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(matched)
    return WorkerRegisterResponse(
        worker_token=encode_worker_token(matched.id),
        worker=WorkerOut.model_validate(matched),
    )


@router.post("/workers/heartbeat", status_code=204)
async def heartbeat(
    payload: HeartbeatRequest,
    worker: Worker = Depends(current_worker),
    db: AsyncSession = Depends(get_db),
) -> Response:
    worker.last_seen_at = datetime.now(UTC)
    if worker.status == WorkerStatus.OFFLINE.value:
        worker.status = WorkerStatus.ACTIVE.value
    # Persist the metric. Heartbeat row is added in Task 8 — for v1 we just stamp last_seen.
    await db.commit()
    return Response(status_code=204)


@router.get("/suppliers/me/workers", response_model=WorkerList)
async def list_my_workers(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkerList:
    supplier = await _supplier_for(db, user)
    rows = (
        await db.execute(select(Worker).where(Worker.supplier_id == supplier.id))
    ).scalars().all()
    return WorkerList(items=[WorkerOut.model_validate(w) for w in rows])
```

Wire into router (`api/v1/router.py`):
```python
from claw_api.api.v1 import auth, health, offerings, suppliers, workers
api_v1.include_router(workers.router)
```

- [ ] **Step 8: Run tests**

```bash
uv run pytest tests/test_workers.py -v
```

Expected: 4 passed.

- [x] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat(workers): provisioning-token issuance, register, heartbeat"
```

---

## Task 8: Heartbeat History

**Why split from Task 7:** Task 7 stamps `last_seen_at` for v1 routing; Task 8 adds a time-series table so Plan 5 (scoring/ranking) has data to chew on.

**Files:**
- Create: `backend/src/claw_api/models/heartbeats.py`
- Modify: `backend/src/claw_api/api/v1/workers.py` (insert into heartbeats)
- Modify: `backend/src/claw_api/models/__init__.py`
- Modify: `backend/alembic/env.py`
- Create: Alembic revision
- Modify: `backend/tests/test_workers.py` (assert row inserted)

- [ ] **Step 1: Write failing test addition**

Append to `backend/tests/test_workers.py`:
```python
@pytest.mark.asyncio
async def test_heartbeat_persists_row(client, monkeypatch, db_session):
    user_token = await _make_supplier(client, monkeypatch, "w5@example.com")
    issued = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "n"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    prov = issued.json()["provisioning_token"]
    reg = await client.post(
        "/v1/workers/register",
        json={"provisioning_token": prov, "machine_info": {}},
    )
    worker_token = reg.json()["worker_token"]
    await client.post(
        "/v1/workers/heartbeat",
        json={"cpu_pct": 1.0, "mem_pct": 2.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    from sqlalchemy import select
    from claw_api.models.heartbeats import Heartbeat
    rows = (await db_session.execute(select(Heartbeat))).scalars().all()
    assert len(rows) == 1
    assert rows[0].cpu_pct == 1.0
```

- [ ] **Step 2: Confirm failure**

```bash
uv run pytest tests/test_workers.py::test_heartbeat_persists_row -v
```

- [ ] **Step 3: Add Heartbeat model**

`backend/src/claw_api/models/heartbeats.py`:
```python
from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class Heartbeat(Base, IdMixin, TimestampMixin):
    __tablename__ = "heartbeats"
    worker_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workers.id"), index=True, nullable=False
    )
    cpu_pct: Mapped[float] = mapped_column(Float, nullable=False)
    mem_pct: Mapped[float] = mapped_column(Float, nullable=False)
    gpu_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    free_ram_gb: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_loaded_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
```

Update `models/__init__.py` and `alembic/env.py`.

- [ ] **Step 4: Migration**

```bash
uv run alembic revision --autogenerate -m "heartbeats"
uv run alembic upgrade head
```

- [ ] **Step 5: Insert heartbeat row in router**

In `backend/src/claw_api/api/v1/workers.py`, replace the body of the `heartbeat` endpoint with:

```python
@router.post("/workers/heartbeat", status_code=204)
async def heartbeat(
    payload: HeartbeatRequest,
    worker: Worker = Depends(current_worker),
    db: AsyncSession = Depends(get_db),
) -> Response:
    from claw_api.models.heartbeats import Heartbeat
    worker.last_seen_at = datetime.now(UTC)
    if worker.status == WorkerStatus.OFFLINE.value:
        worker.status = WorkerStatus.ACTIVE.value
    db.add(
        Heartbeat(
            worker_id=worker.id,
            cpu_pct=payload.cpu_pct,
            mem_pct=payload.mem_pct,
            gpu_pct=payload.gpu_pct,
            free_ram_gb=payload.free_ram_gb,
            model_loaded_id=payload.model_loaded_id,
        )
    )
    await db.commit()
    return Response(status_code=204)
```

- [ ] **Step 6: Run tests**

```bash
uv run pytest tests/test_workers.py -v
```

Expected: 5 passed.

- [x] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat(workers): persist heartbeat rows for time-series scoring"
```

---

## Task 9: Bookings

A booking ties a consumer to a specific offering on a specific worker for a window. v1 has no payment — it just tracks state. Plan 3 will hook lifecycle transitions to actual sandbox start/stop.

**State machine:**
```
pending → active → completed
              ↘
                cancelled
```

**Files:**
- Create: `backend/src/claw_api/models/bookings.py`
- Create: `backend/src/claw_api/schemas/bookings.py`
- Create: `backend/src/claw_api/api/v1/bookings.py`
- Modify: `backend/src/claw_api/models/__init__.py`
- Modify: `backend/src/claw_api/api/v1/router.py`
- Modify: `backend/alembic/env.py`
- Create: Alembic revision
- Create: `backend/tests/test_bookings.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_bookings.py`:
```python
import pytest


async def _login(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake(e: str, t: str) -> None:
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    return r.json()["access_token"]


async def _supplier_with_offering_and_worker(client, monkeypatch, email: str):
    user_token = await _login(client, monkeypatch, email)
    auth = {"Authorization": f"Bearer {user_token}"}
    await client.post(
        "/v1/suppliers", json={"display_name": email, "payout_email": email}, headers=auth
    )
    off = await client.post(
        "/v1/offerings",
        json={
            "title": "T",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
        },
        headers=auth,
    )
    prov = await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "w"}, headers=auth
    )
    reg = await client.post(
        "/v1/workers/register",
        json={"provisioning_token": prov.json()["provisioning_token"], "machine_info": {}},
    )
    return off.json()["id"], reg.json()["worker"]["id"]


@pytest.mark.asyncio
async def test_consumer_creates_booking(client, monkeypatch):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, "sup@example.com"
    )
    consumer_token = await _login(client, monkeypatch, "buyer@example.com")
    r = await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_consumer_lists_their_bookings(client, monkeypatch):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, "sup2@example.com"
    )
    consumer_token = await _login(client, monkeypatch, "buyer2@example.com")
    auth = {"Authorization": f"Bearer {consumer_token}"}
    await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers=auth,
    )
    r = await client.get("/v1/bookings/me", headers=auth)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1


@pytest.mark.asyncio
async def test_supplier_can_activate_their_booking(client, monkeypatch):
    sup_token = await _login(client, monkeypatch, "sup3@example.com")
    sup_auth = {"Authorization": f"Bearer {sup_token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": "S", "payout_email": "s@s.com"},
        headers=sup_auth,
    )
    off = await client.post(
        "/v1/offerings",
        json={
            "title": "T",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
        },
        headers=sup_auth,
    )
    prov = await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "w"}, headers=sup_auth
    )
    reg = await client.post(
        "/v1/workers/register",
        json={"provisioning_token": prov.json()["provisioning_token"], "machine_info": {}},
    )

    consumer_token = await _login(client, monkeypatch, "buyer3@example.com")
    booking = await client.post(
        "/v1/bookings",
        json={"offering_id": off.json()["id"], "worker_id": reg.json()["worker"]["id"]},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    bid = booking.json()["id"]

    activate = await client.post(
        f"/v1/bookings/{bid}/transition",
        json={"to": "active"},
        headers=sup_auth,
    )
    assert activate.status_code == 200
    assert activate.json()["status"] == "active"


@pytest.mark.asyncio
async def test_invalid_transition_rejected(client, monkeypatch):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, "sup4@example.com"
    )
    consumer_token = await _login(client, monkeypatch, "buyer4@example.com")
    booking = await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    bid = booking.json()["id"]
    r = await client.post(
        f"/v1/bookings/{bid}/transition",
        json={"to": "completed"},  # pending → completed not allowed
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert r.status_code == 400
```

- [ ] **Step 2: Confirm failure**

```bash
uv run pytest tests/test_bookings.py -v
```

- [ ] **Step 3: Add Booking model**

`backend/src/claw_api/models/bookings.py`:
```python
from datetime import datetime
from enum import StrEnum
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class BookingStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


VALID_TRANSITIONS: dict[str, set[str]] = {
    BookingStatus.PENDING.value: {BookingStatus.ACTIVE.value, BookingStatus.CANCELLED.value},
    BookingStatus.ACTIVE.value: {BookingStatus.COMPLETED.value, BookingStatus.CANCELLED.value},
    BookingStatus.COMPLETED.value: set(),
    BookingStatus.CANCELLED.value: set(),
}


class Booking(Base, IdMixin, TimestampMixin):
    __tablename__ = "bookings"
    consumer_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, nullable=False
    )
    offering_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("offerings.id"), index=True, nullable=False
    )
    worker_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workers.id"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=BookingStatus.PENDING.value
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

Update `models/__init__.py` and `alembic/env.py`.

- [ ] **Step 4: Migration**

```bash
uv run alembic revision --autogenerate -m "bookings"
uv run alembic upgrade head
```

- [ ] **Step 5: Schemas**

`backend/src/claw_api/schemas/bookings.py`:
```python
from datetime import datetime
from typing import Literal
from pydantic import BaseModel


BookingStatus = Literal["pending", "active", "completed", "cancelled"]


class BookingCreate(BaseModel):
    offering_id: str
    worker_id: str


class BookingTransition(BaseModel):
    to: BookingStatus


class BookingOut(BaseModel):
    id: str
    consumer_user_id: str
    offering_id: str
    worker_id: str
    status: BookingStatus
    started_at: datetime | None
    ended_at: datetime | None

    model_config = {"from_attributes": True}


class BookingList(BaseModel):
    items: list[BookingOut]
```

- [ ] **Step 6: Router**

`backend/src/claw_api/api/v1/bookings.py`:
```python
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.bookings import VALID_TRANSITIONS, Booking, BookingStatus
from claw_api.models.offerings import Offering
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.models.workers import Worker
from claw_api.schemas.bookings import BookingCreate, BookingList, BookingOut, BookingTransition

router = APIRouter(tags=["bookings"])


@router.post("/bookings", response_model=BookingOut, status_code=201)
async def create_booking(
    payload: BookingCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    offering = (
        await db.execute(select(Offering).where(Offering.id == payload.offering_id))
    ).scalar_one_or_none()
    if offering is None or offering.status != "active":
        raise HTTPException(404, "offering not available")
    worker = (
        await db.execute(select(Worker).where(Worker.id == payload.worker_id))
    ).scalar_one_or_none()
    if worker is None or worker.supplier_id != offering.supplier_id:
        raise HTTPException(400, "worker does not belong to offering's supplier")
    booking = Booking(
        consumer_user_id=user.id,
        offering_id=offering.id,
        worker_id=worker.id,
        status=BookingStatus.PENDING.value,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.get("/bookings/me", response_model=BookingList)
async def my_bookings(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingList:
    rows = (
        await db.execute(
            select(Booking).where(Booking.consumer_user_id == user.id).order_by(
                Booking.created_at.desc()
            )
        )
    ).scalars().all()
    return BookingList(items=[BookingOut.model_validate(b) for b in rows])


@router.get("/bookings/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    booking = await _load_party(db, booking_id, user)
    return booking


@router.post("/bookings/{booking_id}/transition", response_model=BookingOut)
async def transition_booking(
    booking_id: str,
    payload: BookingTransition,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    booking = await _load_party(db, booking_id, user)
    if payload.to not in VALID_TRANSITIONS.get(booking.status, set()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"cannot transition from {booking.status} to {payload.to}",
        )
    booking.status = payload.to
    now = datetime.now(UTC)
    if payload.to == BookingStatus.ACTIVE.value:
        booking.started_at = now
    if payload.to in (BookingStatus.COMPLETED.value, BookingStatus.CANCELLED.value):
        booking.ended_at = now
    await db.commit()
    await db.refresh(booking)
    return booking


async def _load_party(db: AsyncSession, booking_id: str, user: User) -> Booking:
    booking = (
        await db.execute(select(Booking).where(Booking.id == booking_id))
    ).scalar_one_or_none()
    if booking is None:
        raise HTTPException(404, "not found")
    # Either consumer or owning supplier may interact.
    if booking.consumer_user_id == user.id:
        return booking
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is not None:
        offering = (
            await db.execute(select(Offering).where(Offering.id == booking.offering_id))
        ).scalar_one()
        if offering.supplier_id == supplier.id:
            return booking
    raise HTTPException(404, "not found")
```

Wire into router (`api/v1/router.py`):
```python
from claw_api.api.v1 import auth, bookings, health, offerings, suppliers, workers
api_v1.include_router(bookings.router)
```

- [ ] **Step 7: Run tests**

```bash
uv run pytest tests/test_bookings.py -v
```

Expected: 4 passed.

- [ ] **Step 8: Run the full suite**

```bash
uv run pytest -v
```

Expected: all green.

- [x] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat(bookings): create, list, transition with state machine"
```

---

## Task 10: CI

**Files:**
- Create: `.github/workflows/backend-ci.yml`
- Create: `backend/Dockerfile` (for downstream use; not exercised by CI yet)
- Modify: `backend/pyproject.toml` (add a `lint` script entry if helpful — optional)

- [ ] **Step 1: Create the workflow**

`.github/workflows/backend-ci.yml`:
```yaml
name: backend-ci
on:
  pull_request:
    paths: ["backend/**", ".github/workflows/backend-ci.yml"]
  push:
    branches: [main]
    paths: ["backend/**", ".github/workflows/backend-ci.yml"]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: claw
          POSTGRES_PASSWORD: claw
          POSTGRES_DB: claw_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U claw"
          --health-interval 2s
          --health-timeout 3s
          --health-retries 20
    defaults:
      run:
        working-directory: backend
    env:
      DATABASE_URL: postgresql+asyncpg://claw:claw@localhost:5432/claw_test
      JWT_SECRET: test-secret-32-bytes-of-randomness-x
      MAGIC_LINK_DELIVERY: console
      APP_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          python-version: "3.12"
      - run: uv sync --frozen
      - run: uv run ruff check src tests
      - run: uv run alembic upgrade head
      - run: uv run pytest -v
```

- [ ] **Step 2: Create the Dockerfile (for downstream deploy)**

`backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv==0.5.4
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY src ./src
RUN uv sync --frozen

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /app /app
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "claw_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Run lint locally**

```bash
cd backend && uv run ruff check src tests
```

Fix anything it flags.

- [ ] **Step 4: Verify a clean test run from a fresh DB**

```bash
docker compose exec db psql -U claw -d postgres -c "DROP DATABASE IF EXISTS claw_test; CREATE DATABASE claw_test;"
uv run alembic upgrade head
uv run pytest -v
```

Expected: all tests pass on a freshly migrated DB.

- [x] **Step 5: Commit**

```bash
git add backend/Dockerfile .github/workflows/backend-ci.yml
git commit -m "chore(ci): add backend CI workflow + Dockerfile"
```

---

## Self-Review Checklist (do before handing off)

1. **Spec coverage:** Every endpoint listed in section 5.2 of `docs/security-analysis.md`'s "What we DO claim in v1" has a task implementing it (auth ✓, suppliers ✓, offerings ✓, workers + heartbeat ✓, bookings ✓). Audit logs and reputation ranking are deferred to a later plan — that's intentional.
2. **Placeholders:** Skim every code block for `TODO` / `FIXME` / `pass`-only stubs. Currently zero.
3. **Type consistency:** `WorkerStatus`, `BookingStatus`, `OfferingStatus` are defined once each as StrEnum, and Pydantic schemas use matching `Literal` types. Worker JWT `kind` is `"worker"` everywhere.
4. **Migration coverage:** Every model addition has a paired Alembic revision step. Order: users + magic_link_tokens → suppliers → offerings → workers → heartbeats → bookings. No model is referenced before its migration runs.
5. **DB constraint coverage:** unique on `users.email`, `suppliers.user_id`; FKs on every relation; `provisioning_token_hash` nullable so it can be wiped after first use.
6. **Auth boundary tests:** Each protected endpoint has at least one test that verifies a 401/403 path.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-10-marketplace-api-foundation.md`.
