import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import RefreshToken, User, UserRole
from app.schemas.auth import RegisterIn


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def _new_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Store the hash; send the raw token."""
    raw = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def _refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


async def register_user(db: AsyncSession, data: RegisterIn) -> tuple[User, str, str]:
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        email=data.email,
        name=data.name,
        role=UserRole(data.role),
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.flush()

    raw_refresh, hashed_refresh = _new_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=_refresh_token_expiry(),
    ))
    await db.commit()
    await db.refresh(user)

    return user, create_access_token(str(user.id), user.role.value), raw_refresh


async def login_user(db: AsyncSession, email: str, password: str) -> tuple[User, str, str]:
    result = await db.execute(
        select(User).where(User.email == email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid credentials")

    raw_refresh, hashed_refresh = _new_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=_refresh_token_expiry(),
    ))
    await db.commit()

    return user, create_access_token(str(user.id), user.role.value), raw_refresh


async def rotate_refresh_token(db: AsyncSession, raw_token: str) -> tuple[User, str, str]:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise ValueError("Invalid or expired refresh token")

    record.revoked_at = now

    user = await db.get(User, record.user_id)
    if not user or not user.is_active:
        raise ValueError("User not found or inactive")

    raw_new, hashed_new = _new_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hashed_new,
        expires_at=_refresh_token_expiry(),
    ))
    await db.commit()

    return user, create_access_token(str(user.id), user.role.value), raw_new


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    record = result.scalar_one_or_none()
    if record:
        record.revoked_at = datetime.now(timezone.utc)
        await db.commit()
