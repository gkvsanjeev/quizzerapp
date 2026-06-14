# Database Schema — QuizzerApp

**Engine**: PostgreSQL 16 (Neon Serverless)
**Extensions**: `uuid-ossp`, `pgvector`
**ORM**: SQLAlchemy 2.x (async), Alembic migrations

---

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Enums

```sql
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE attempt_status AS ENUM ('in_progress', 'submitted', 'timed_out');
CREATE TYPE doc_status AS ENUM ('pending', 'processing', 'ready', 'failed');
```

---

## Auth & Users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'student',
    hashed_password TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,   -- bcrypt hash of raw token
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

---

## Exam Content

```sql
CREATE TABLE exams (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        TEXT NOT NULL,
    description  TEXT,
    exam_type    TEXT NOT NULL,          -- e.g. 'JEE', 'NEET', 'GATE', 'Custom'
    created_by   UUID NOT NULL REFERENCES users(id),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subjects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id     UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_subjects_exam_id ON subjects(exam_id);

CREATE TABLE topics (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name       TEXT NOT NULL
);
CREATE INDEX idx_topics_subject_id ON topics(subject_id);

CREATE TABLE questions (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id     UUID NOT NULL REFERENCES subjects(id),
    topic_id       UUID REFERENCES topics(id),
    text           TEXT NOT NULL,
    image_url      TEXT,
    difficulty     difficulty_level NOT NULL DEFAULT 'medium',
    explanation    TEXT,
    tags           TEXT[] NOT NULL DEFAULT '{}',
    source_doc_id  UUID REFERENCES documents(id) ON DELETE SET NULL,  -- RAG source
    created_by     UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_questions_subject_id ON questions(subject_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_tags ON questions USING GIN(tags);

CREATE TABLE options (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_key  CHAR(1) NOT NULL CHECK (option_key IN ('A','B','C','D')),
    text        TEXT NOT NULL,
    image_url   TEXT,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(question_id, option_key)
);
CREATE INDEX idx_options_question_id ON options(question_id);

CREATE TABLE test_papers (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id                 UUID NOT NULL REFERENCES exams(id),
    title                   TEXT NOT NULL,
    scheduled_at            TIMESTAMPTZ,
    duration_seconds        INTEGER NOT NULL,
    total_marks             NUMERIC(8,2) NOT NULL,
    negative_marking_factor NUMERIC(4,2) NOT NULL DEFAULT 0.25,
    shuffle_questions       BOOLEAN NOT NULL DEFAULT FALSE,
    shuffle_options         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE test_paper_questions (
    test_paper_id  UUID NOT NULL REFERENCES test_papers(id) ON DELETE CASCADE,
    question_id    UUID NOT NULL REFERENCES questions(id),
    marks          NUMERIC(5,2) NOT NULL DEFAULT 4,
    negative_marks NUMERIC(5,2) NOT NULL DEFAULT 1,
    display_order  INTEGER NOT NULL,
    subject_section TEXT,   -- optional label for grouping (e.g. "Physics Section A")
    PRIMARY KEY (test_paper_id, question_id)
);
CREATE INDEX idx_tpq_test_paper_id ON test_paper_questions(test_paper_id);
```

---

## Attempts & Answers

```sql
CREATE TABLE attempts (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES users(id),
    test_paper_id  UUID NOT NULL REFERENCES test_papers(id),
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at   TIMESTAMPTZ,
    status         attempt_status NOT NULL DEFAULT 'in_progress',
    raw_score      NUMERIC(8,2),
    final_score    NUMERIC(8,2),   -- after negative marking
    rank           INTEGER,
    percentile     NUMERIC(5,2),
    UNIQUE(user_id, test_paper_id)  -- one attempt per user per paper
);
CREATE INDEX idx_attempts_user_id ON attempts(user_id);
CREATE INDEX idx_attempts_test_paper_id ON attempts(test_paper_id);

CREATE TABLE attempt_answers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id          UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id         UUID NOT NULL REFERENCES questions(id),
    selected_option_id  UUID REFERENCES options(id),   -- NULL = not answered / skipped
    time_spent_seconds  INTEGER NOT NULL DEFAULT 0,
    first_visited_at    TIMESTAMPTZ,
    last_visited_at     TIMESTAMPTZ,
    visit_count         INTEGER NOT NULL DEFAULT 0,
    is_marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
    change_count        INTEGER NOT NULL DEFAULT 0,     -- number of times answer changed
    UNIQUE(attempt_id, question_id)
);
CREATE INDEX idx_attempt_answers_attempt_id ON attempt_answers(attempt_id);

CREATE TABLE attempt_subject_stats (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id          UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    subject_id          UUID NOT NULL REFERENCES subjects(id),
    correct_count       INTEGER NOT NULL DEFAULT 0,
    incorrect_count     INTEGER NOT NULL DEFAULT 0,
    skipped_count       INTEGER NOT NULL DEFAULT 0,
    unattempted_count   INTEGER NOT NULL DEFAULT 0,
    total_time_seconds  INTEGER NOT NULL DEFAULT 0,
    score               NUMERIC(8,2) NOT NULL DEFAULT 0,
    max_score           NUMERIC(8,2) NOT NULL DEFAULT 0,
    UNIQUE(attempt_id, subject_id)
);

CREATE TABLE leaderboard_cache (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_paper_id  UUID NOT NULL REFERENCES test_papers(id) ON DELETE CASCADE,
    computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data           JSONB NOT NULL   -- [{user_id, name, score, rank, percentile}]
);
CREATE INDEX idx_leaderboard_test_paper_id ON leaderboard_cache(test_paper_id);
```

---

## RAG Pipeline

```sql
CREATE TABLE documents (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by       UUID NOT NULL REFERENCES users(id),
    filename          TEXT NOT NULL,
    file_type         TEXT NOT NULL,   -- 'pdf', 'image/png', 'image/jpeg'
    storage_url       TEXT NOT NULL,   -- Vercel Blob or S3 URL
    processing_status doc_status NOT NULL DEFAULT 'pending',
    page_count        INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_chunks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    chunk_index  INTEGER NOT NULL,
    page_number  INTEGER,
    embedding    vector(1536),    -- OpenAI text-embedding-3-small output
    metadata     JSONB NOT NULL DEFAULT '{}',
    UNIQUE(document_id, chunk_index)
);
CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
-- IVFFlat index for vector similarity search (build after loading data)
-- CREATE INDEX idx_chunks_embedding ON document_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## SQLAlchemy Model Files

| File | Tables |
|---|---|
| `backend/app/models/user.py` | `users`, `refresh_tokens` |
| `backend/app/models/exam.py` | `exams`, `subjects`, `topics` |
| `backend/app/models/question.py` | `questions`, `options` |
| `backend/app/models/test_paper.py` | `test_papers`, `test_paper_questions` |
| `backend/app/models/attempt.py` | `attempts`, `attempt_answers`, `attempt_subject_stats`, `leaderboard_cache` |
| `backend/app/models/rag.py` | `documents`, `document_chunks` |

---

## Key Relationships

```
users ──< exams (created_by)
exams ──< subjects ──< topics
subjects ──< questions ──< options
test_papers ──< test_paper_questions >── questions
users ──< attempts >── test_papers
attempts ──< attempt_answers >── questions
attempts ──< attempt_subject_stats >── subjects
users ──< documents ──< document_chunks
questions >── documents (source_doc_id, optional)
```

---

## Alembic Usage

```bash
# Generate a new migration
cd backend && uv run alembic revision --autogenerate -m "description"

# Apply all pending migrations
uv run alembic upgrade head

# Rollback one step
uv run alembic downgrade -1
```

Migration files live in `backend/app/db/migrations/versions/`.
