-- ─────────────────────────────────────────────────────────────────────────────
-- QuizzerApp — PostgreSQL initialisation script
-- Runs once when the container is first created (not on subsequent starts).
-- ─────────────────────────────────────────────────────────────────────────────

-- Create the test database (main DB 'quizzerapp' is created by POSTGRES_DB env var)
CREATE DATABASE quizzerapp_test OWNER quizzer;

-- ── Main database ─────────────────────────────────────────────────────────────
\connect quizzerapp

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Confirm
DO $$
BEGIN
  RAISE NOTICE 'Extensions enabled on quizzerapp: uuid-ossp, vector';
END $$;

-- ── Test database ─────────────────────────────────────────────────────────────
\connect quizzerapp_test

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

GRANT ALL PRIVILEGES ON DATABASE quizzerapp_test TO quizzer;

DO $$
BEGIN
  RAISE NOTICE 'Extensions enabled on quizzerapp_test: uuid-ossp, vector';
END $$;
