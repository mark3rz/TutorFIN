"""
Alembic environment configuration for DataArch.AI.

Reads DATABASE_URL from config.py so migrations always use the same
connection string as the running application.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ── Import our models so metadata is populated ─────────────────────────────
import config as app_config  # noqa: F401 – side-effect: loads .env
from models import Base

# ── Alembic Config object ──────────────────────────────────────────────────
alembic_cfg = context.config

# Override sqlalchemy.url with the app's DATABASE_URL
alembic_cfg.set_main_option("sqlalchemy.url", app_config.DATABASE_URL)

# Set up Python logging from alembic.ini
if alembic_cfg.config_file_name is not None:
    fileConfig(alembic_cfg.config_file_name)

# Target metadata for autogenerate support
target_metadata = Base.metadata


# ── Offline mode (generates SQL scripts without a live DB) ─────────────────

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine.
    Calls to context.execute() emit the given string to the script output.
    """
    url = alembic_cfg.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (connects to the live DB) ──────────────────────────────────

def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Creates an Engine and associates a connection with the context.
    """
    connectable = engine_from_config(
        alembic_cfg.get_section(alembic_cfg.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
