from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginIn, RefreshOut, RegisterIn, TokenOut, UserOut
from app.services import auth_service

router = APIRouter()

_COOKIE = "refresh_token"
_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=_COOKIE,
        value=raw_token,
        httponly=True,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
        secure=True,
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    try:
        user, access_token, raw_refresh = await auth_service.register_user(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    _set_refresh_cookie(response, raw_refresh)
    return TokenOut(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
async def login(
    data: LoginIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    try:
        user, access_token, raw_refresh = await auth_service.login_user(db, data.email, data.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    _set_refresh_cookie(response, raw_refresh)
    return TokenOut(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=RefreshOut)
async def refresh_token(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token_cookie: str | None = Cookie(default=None, alias=_COOKIE),
):
    if not refresh_token_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    try:
        _, access_token, raw_new = await auth_service.rotate_refresh_token(db, refresh_token_cookie)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    _set_refresh_cookie(response, raw_new)
    return RefreshOut(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token_cookie: str | None = Cookie(default=None, alias=_COOKIE),
):
    if refresh_token_cookie:
        await auth_service.revoke_refresh_token(db, refresh_token_cookie)
    response.delete_cookie(_COOKIE)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
