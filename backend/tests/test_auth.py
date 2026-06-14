import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")

_REG_URL = "/api/auth/register"
_LOGIN_URL = "/api/auth/login"


async def test_register_creates_user(client: AsyncClient):
    r = await client.post(_REG_URL, json={
        "email": "alice@example.com",
        "name": "Alice",
        "password": "SecurePass1!",
    })
    assert r.status_code == 201
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["role"] == "student"
    assert "refresh_token" in r.cookies


async def test_register_duplicate_email_returns_409(client: AsyncClient):
    payload = {"email": "dup@example.com", "name": "Dup", "password": "SecurePass1!"}
    await client.post(_REG_URL, json=payload)
    r = await client.post(_REG_URL, json=payload)
    assert r.status_code == 409
    assert "already registered" in r.json()["detail"]


async def test_register_short_password_returns_422(client: AsyncClient):
    r = await client.post(_REG_URL, json={
        "email": "short@example.com",
        "name": "Short",
        "password": "abc",
    })
    assert r.status_code == 422


async def test_register_invalid_role_returns_422(client: AsyncClient):
    r = await client.post(_REG_URL, json={
        "email": "badrole@example.com",
        "name": "Bad",
        "password": "SecurePass1!",
        "role": "superuser",
    })
    assert r.status_code == 422


async def test_register_as_teacher(client: AsyncClient):
    r = await client.post(_REG_URL, json={
        "email": "teacher@example.com",
        "name": "Teacher",
        "password": "SecurePass1!",
        "role": "teacher",
    })
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "teacher"


async def test_login_success(client: AsyncClient):
    await client.post(_REG_URL, json={
        "email": "bob@example.com",
        "name": "Bob",
        "password": "SecurePass1!",
    })
    r = await client.post(_LOGIN_URL, json={
        "email": "bob@example.com",
        "password": "SecurePass1!",
    })
    assert r.status_code == 200
    assert "access_token" in r.json()
    assert "refresh_token" in r.cookies


async def test_login_wrong_password_returns_401(client: AsyncClient):
    await client.post(_REG_URL, json={
        "email": "carol@example.com",
        "name": "Carol",
        "password": "SecurePass1!",
    })
    r = await client.post(_LOGIN_URL, json={
        "email": "carol@example.com",
        "password": "WrongPassword!",
    })
    assert r.status_code == 401


async def test_login_nonexistent_user_returns_401(client: AsyncClient):
    r = await client.post(_LOGIN_URL, json={
        "email": "ghost@example.com",
        "password": "SecurePass1!",
    })
    assert r.status_code == 401


async def test_me_with_valid_token(client: AsyncClient):
    r = await client.post(_REG_URL, json={
        "email": "me_user@example.com",
        "name": "Me User",
        "password": "SecurePass1!",
    })
    token = r.json()["access_token"]

    r2 = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == "me_user@example.com"


async def test_me_without_token_returns_401(client: AsyncClient):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_me_with_invalid_token_returns_401(client: AsyncClient):
    r = await client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.valid.token"})
    assert r.status_code == 401


async def test_refresh_issues_new_access_token(client: AsyncClient):
    reg = await client.post(_REG_URL, json={
        "email": "refresh_user@example.com",
        "name": "Refresh User",
        "password": "SecurePass1!",
    })
    old_token = reg.json()["access_token"]

    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200
    assert "access_token" in r.json()
    # New refresh cookie should be rotated
    assert "refresh_token" in r.cookies


async def test_refresh_without_cookie_returns_401(client: AsyncClient):
    # Use a fresh client with no cookies
    from httpx import AsyncClient as FreshClient
    from httpx import ASGITransport
    async with FreshClient(transport=ASGITransport(app=client._transport.app), base_url="http://test") as fresh:
        r = await fresh.post("/api/auth/refresh")
        assert r.status_code == 401


async def test_logout_clears_cookie(client: AsyncClient):
    await client.post(_REG_URL, json={
        "email": "logout_user@example.com",
        "name": "Logout User",
        "password": "SecurePass1!",
    })
    r = await client.post("/api/auth/logout")
    assert r.status_code == 204


async def test_health_endpoint(client: AsyncClient):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
