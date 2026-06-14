"""Outbound notification helpers (email).

Password-reset links are delivered by email over Gmail SMTP. Sending is guarded
by `settings.smtp_configured`: when no SMTP App Password is set (e.g. in tests or
a fresh checkout) the send is skipped and only logged, so the auth flow never
depends on live email. Send failures are caught and logged — they must not break
the forgot-password request (which always returns 202).
"""

import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


def _build_reset_message(to_email: str, reset_url: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message["Subject"] = "Reset your QuizzerApp password"
    message.set_content(
        "We received a request to reset your QuizzerApp password.\n\n"
        f"Reset it here (valid for {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes):\n"
        f"{reset_url}\n\n"
        "If you didn't request this, you can safely ignore this email."
    )
    message.add_alternative(
        f"""\
<html><body style="font-family:sans-serif;line-height:1.5">
  <h2>Reset your QuizzerApp password</h2>
  <p>We received a request to reset your password. This link is valid for
     {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes:</p>
  <p><a href="{reset_url}"
        style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;
               text-decoration:none">Reset password</a></p>
  <p style="color:#666;font-size:13px">If you didn't request this, ignore this email.</p>
</body></html>""",
        subtype="html",
    )
    return message


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.smtp_configured:
        # No App Password configured — do not attempt a live send. Never log the URL/token.
        logger.info("SMTP not configured; password-reset link not emailed to %s", to_email)
        return

    try:
        await aiosmtplib.send(
            _build_reset_message(to_email, reset_url),
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_START_TLS,
        )
        logger.info("Password-reset email sent to %s", to_email)
    except Exception:  # noqa: BLE001 — email failure must not break the request
        logger.exception("Failed to send password-reset email to %s", to_email)
