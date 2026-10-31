import os
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_DEFAULT_DB_FILE = os.path.join(_BACKEND_DIR, "brightloop.db").replace("\\", "/")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", os.path.join(_BACKEND_DIR, ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Brightloop Subscription Management System"
    APP_ENV: str = "development"
    APP_TIMEZONE: str = "Asia/Kolkata"

    SECRET_KEY: str = "dev-insecure-secret-key-brightloop-subscription-32bytes"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    RESET_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes

    DATABASE_URL: str = f"sqlite:///{_DEFAULT_DB_FILE}"
    FRONTEND_URL: str = "http://localhost:5173"

    # Company Details for Invoices & Config
    COMPANY_NAME: str = "Brightloop Technologies Pvt Ltd"
    COMPANY_ADDRESS: str = "123 Innovation Way, Tech Park, Bangalore, KA, India"
    COMPANY_TAX_ID: str = "GSTIN29ABCDE1234F1Z5"
    COMPANY_EMAIL: str = "billing@brightloop.io"
    COMPANY_PHONE: str = "+91 80 1234 5678"

    # Email Service
    EMAIL_BACKEND: str = "console"  # "smtp" or "console"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@brightloop.io"
    SMTP_TLS: bool = True

    # Admin Bootstrap & Default Accounts
    ADMIN_EMAIL: Optional[str] = "admin@brightloop.com"
    ADMIN_PASSWORD: Optional[str] = "Admin@1234"
    SEED_DEFAULT_ACCOUNTS: bool = True

    # Scheduler Settings
    SCHEDULER_ENABLED: bool = False  # Disabled by default in dev/test, enabled via env in prod
    SCHEDULER_HOUR: int = 0
    SCHEDULER_MINUTE: int = 0

    @model_validator(mode="after")
    def anchor_sqlite_database_url(self):
        # Anchor relative SQLite database paths to backend directory
        if self.DATABASE_URL.startswith("sqlite:///") and not self.DATABASE_URL.startswith("sqlite:///:memory:"):
            raw_path = self.DATABASE_URL.replace("sqlite:///", "", 1)
            # Handle Windows drive letters like C:/... or C:\...
            is_win_abs = len(raw_path) > 2 and raw_path[1] == ":" and raw_path[2] in ("/", "\\")
            if not os.path.isabs(raw_path) and not is_win_abs:
                clean_path = raw_path.lstrip("./").lstrip(".\\")
                abs_path = os.path.abspath(os.path.join(_BACKEND_DIR, clean_path)).replace("\\", "/")
                self.DATABASE_URL = f"sqlite:///{abs_path}"
        return self


settings = Settings()
