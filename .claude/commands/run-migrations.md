# /run-migrations

Apply all pending Alembic database migrations for QuizzerApp.

## Usage
```
/run-migrations
```

## What this does

1. Verify `DATABASE_URL` is set in `backend/.env`
2. Run `alembic upgrade head` from the `backend/` directory
3. Report which migrations were applied

## Steps

```bash
cd backend
# Check env
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set in backend/.env"
  exit 1
fi

# Run migrations
uv run alembic upgrade head

# Show current revision
uv run alembic current
```

## Common commands

```bash
# Generate new migration after model change
uv run alembic revision --autogenerate -m "add index to questions"

# See migration history
uv run alembic history --verbose

# Rollback one migration
uv run alembic downgrade -1

# Roll back to specific revision
uv run alembic downgrade <revision_id>
```

## Migration file location
`backend/app/db/migrations/versions/`

## Notes
- Always review auto-generated migration files before applying — Alembic may miss some changes (e.g. custom enum types, pgvector columns)
- For pgvector columns, manually add `sa.Column('embedding', Vector(1536))` using the `pgvector.sqlalchemy` type
- Never edit migration files that have already been applied to production
