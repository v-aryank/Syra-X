import os
from dataclasses import dataclass


def _parse_origins(value: str) -> tuple[str, ...]:
    origins = tuple(origin.strip() for origin in value.split(",") if origin.strip())
    return origins or ("http://localhost:5173",)


@dataclass(frozen=True)
class Settings:
    app_env: str
    frontend_origins: tuple[str, ...]


def get_settings() -> Settings:
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        frontend_origins=_parse_origins(
            os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")
        ),
    )
