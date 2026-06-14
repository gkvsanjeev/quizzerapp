"""Manual SMTP smoke test for the password-reset email.

Usage (from backend/, after setting SMTP_PASSWORD in .env):
    uv run python scripts/send_test_email.py you@example.com

Sends a sample reset email to the given address using the configured Gmail
SMTP settings. Prints whether SMTP is configured and the send result.
"""

import asyncio
import sys

from app.config import settings
from app.services.notifications import send_password_reset_email


async def main(to: str) -> None:
    print(f"smtp_configured = {settings.smtp_configured}")
    print(f"from            = {settings.SMTP_FROM_EMAIL}")
    print(f"host:port       = {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    if not settings.smtp_configured:
        print("SMTP_PASSWORD is empty — set a Gmail App Password in .env first.")
        return
    sample = f"{settings.FRONTEND_URL}/reset-password?token=SMOKE_TEST_TOKEN"
    await send_password_reset_email(to, sample)
    print(f"Send attempted to {to}. Check the inbox (and spam).")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: uv run python scripts/send_test_email.py <recipient@example.com>")
        raise SystemExit(2)
    asyncio.run(main(sys.argv[1]))
