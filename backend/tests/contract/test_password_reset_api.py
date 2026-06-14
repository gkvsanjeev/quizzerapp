"""Contract tests for the password-reset flow (T069).

  POST /api/auth/forgot-password { email }          → 202 (always; no enumeration)
  POST /api/auth/reset-password  { token, new_password } → 200 | 400 | 422

The reset token is normally delivered by email. Tests mint it directly via
auth_service.create_password_reset (the `client` fixture shares the test
db_session), which stands in for "the user opened the emailed link".

RED phase: routes are not implemented yet, so the HTTP calls 404 and these
fail until T070.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import PasswordResetToken
from app.services import auth_service

pytestmark = pytest.mark.asyncio(loop_scope="session")

_FORGOT = "/api/auth/forgot-password"
_RESET = "/api/auth/reset-password"
_LOGIN = "/api/auth/login"
_OLD_PW = "SecurePass1!"
_NEW_PW = "BrandNewPass9!"


async def _register(client, email: str) -> None:
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "name": email.split("@")[0], "password": _OLD_PW},
    )
    assert r.status_code == 201, r.text


# ─── forgot-password ────────────────────────────────────
async def test_forgot_password_known_email_returns_202(client):
    await _register(client, "forgot_known@example.com")
    r = await client.post(_FORGOT, json={"email": "forgot_known@example.com"})
    assert r.status_code == 202


async def test_forgot_password_unknown_email_also_returns_202(client):
    # No user enumeration: the response must be identical for unknown emails.
    r = await client.post(_FORGOT, json={"email": "nobody@example.com"})
    assert r.status_code == 202


async def test_forgot_password_invalid_email_returns_422(client):
    r = await client.post(_FORGOT, json={"email": "not-an-email"})
    assert r.status_code == 422


# ─── reset-password ─────────────────────────────────────
async def test_reset_with_valid_token_sets_new_password(client, db_session: AsyncSession):
    await _register(client, "reset_valid@example.com")
    _, raw = await auth_service.create_password_reset(db_session, "reset_valid@example.com")

    r = await client.post(_RESET, json={"token": raw, "new_password": _NEW_PW})
    assert r.status_code == 200

    # New password works; old one no longer does.
    ok = await client.post(_LOGIN, json={"email": "reset_valid@example.com", "password": _NEW_PW})
    assert ok.status_code == 200
    bad = await client.post(_LOGIN, json={"email": "reset_valid@example.com", "password": _OLD_PW})
    assert bad.status_code == 401


async def test_reset_with_invalid_token_returns_400(client):
    r = await client.post(_RESET, json={"token": "totally-bogus-token", "new_password": _NEW_PW})
    assert r.status_code == 400


async def test_reset_with_expired_token_returns_400(client, db_session: AsyncSession):
    await _register(client, "reset_expired@example.com")
    user, raw = await auth_service.create_password_reset(db_session, "reset_expired@example.com")
    rec = (
        await db_session.execute(
            select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
        )
    ).scalar_one()
    rec.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db_session.commit()

    r = await client.post(_RESET, json={"token": raw, "new_password": _NEW_PW})
    assert r.status_code == 400


async def test_reset_token_is_single_use(client, db_session: AsyncSession):
    await _register(client, "reset_reuse@example.com")
    _, raw = await auth_service.create_password_reset(db_session, "reset_reuse@example.com")

    first = await client.post(_RESET, json={"token": raw, "new_password": _NEW_PW})
    assert first.status_code == 200
    second = await client.post(_RESET, json={"token": raw, "new_password": "AnotherPass1!"})
    assert second.status_code == 400


async def test_reset_short_password_returns_422(client, db_session: AsyncSession):
    await _register(client, "reset_short@example.com")
    _, raw = await auth_service.create_password_reset(db_session, "reset_short@example.com")

    r = await client.post(_RESET, json={"token": raw, "new_password": "abc"})
    assert r.status_code == 422
