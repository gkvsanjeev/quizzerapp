from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to the backend/ root (this file lives at backend/app/config.py),
# so settings load correctly no matter which directory the process is launched from.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost/quizzerapp"
    SECRET_KEY: str = "change-me-in-production-min-32-characters-long!!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    # Public base URL of the frontend SPA — used to build password-reset links.
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Email / SMTP (Gmail) ──────────────────────────────────────────────
    # Gmail requires an App Password (16 chars, 2-Step Verification enabled),
    # NOT the account password. Set SMTP_PASSWORD in .env; never commit it.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "sanjiv.gkv@gmail.com"
    SMTP_PASSWORD: str = ""  # Gmail App Password — from .env only
    SMTP_FROM_EMAIL: str = "sanjiv.gkv@gmail.com"
    SMTP_FROM_NAME: str = "QuizzerApp"
    SMTP_START_TLS: bool = True  # STARTTLS on port 587

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_PASSWORD and self.SMTP_USER)

    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    VERCEL_BLOB_READ_WRITE_TOKEN: str = ""

    ENVIRONMENT: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
