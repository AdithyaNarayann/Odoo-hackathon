import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from fastapi import BackgroundTasks

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email_sync(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> None:
    """Send an email using configured EMAIL_BACKEND ('console' or 'smtp'). Never crashes on failure."""
    try:
        if settings.EMAIL_BACKEND.lower() == "console":
            logger.info(
                "\n==================== [CONSOLE EMAIL] ====================\n"
                "To: %s\n"
                "Subject: %s\n"
                "Body:\n%s\n"
                "=========================================================",
                to_email,
                subject,
                text_body or html_body,
            )
            return

        if settings.EMAIL_BACKEND.lower() == "smtp":
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM
            msg["To"] = to_email

            if text_body:
                msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info("Successfully sent SMTP email to %s", to_email)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, str(exc), exc_info=True)


def send_password_reset_email(
    to_email: str,
    reset_token: str,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Dispatches a password reset email."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    subject = f"[{settings.APP_NAME}] Password Reset Request"
    text_body = (
        f"You requested a password reset for your {settings.APP_NAME} account.\n\n"
        f"Click the link below to reset your password (valid for {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes):\n"
        f"{reset_url}\n\n"
        f"If you did not request this, please ignore this email."
    )
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; line-height: 1.5;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your <strong>{settings.APP_NAME}</strong> account.</p>
        <p>Please click the button below to reset your password. This link is valid for <strong>{settings.RESET_TOKEN_EXPIRE_MINUTES} minutes</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="{reset_url}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>Or paste this link into your browser:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #666;">If you did not request this password reset, please safely ignore this email.</p>
      </body>
    </html>
    """

    if background_tasks is not None:
        background_tasks.add_task(send_email_sync, to_email, subject, html_body, text_body)
    else:
        send_email_sync(to_email, subject, html_body, text_body)
