"""Outbound notification helpers (email).

The reset link is delivered out-of-band. Wire a real provider (SMTP, SES, or a
transactional API) where indicated — the FastAPI runtime cannot call the
Claude-side Gmail MCP tool, so that is a deploy-time integration, not in-process.
Until then this logs the send (never the token/URL) so the flow is observable.
"""

import logging

logger = logging.getLogger(__name__)


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    # TODO(T070): integrate a transactional email provider and send `reset_url`.
    # Do NOT log reset_url — it contains the single-use token.
    logger.info("Password-reset email queued for %s", to_email)
