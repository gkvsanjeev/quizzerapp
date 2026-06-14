"""Initial schema — all tables

Revision ID: 001_initial
Revises:
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Enum types
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student')")
    op.execute("CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard')")
    op.execute("CREATE TYPE attempt_status AS ENUM ('in_progress', 'submitted', 'timed_out')")
    op.execute("CREATE TYPE doc_status AS ENUM ('pending', 'processing', 'ready', 'failed')")

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("role", postgresql.ENUM("admin", "teacher", "student", name="user_role", create_type=False),
                  nullable=False, server_default="student"),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_hash"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    # exams
    op.create_table(
        "exams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("exam_type", sa.String(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # subjects
    op.create_table(
        "subjects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("exam_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("exams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_subjects_exam_id", "subjects", ["exam_id"])

    # topics
    op.create_table(
        "topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
    )
    op.create_index("ix_topics_subject_id", "topics", ["subject_id"])

    # documents (before questions — FK source_doc_id)
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("storage_url", sa.String(), nullable=False),
        sa.Column("processing_status",
                  postgresql.ENUM("pending", "processing", "ready", "failed", name="doc_status", create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # document_chunks (vector column via raw SQL)
    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=False,
                  server_default=sa.text("'{}'")),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_chunk_doc_index"),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    # Add vector column separately (requires pgvector extension)
    op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)")

    # questions
    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("subjects.id"), nullable=False),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("topics.id"), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("difficulty",
                  postgresql.ENUM("easy", "medium", "hard", name="difficulty_level", create_type=False),
                  nullable=False, server_default="medium"),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False,
                  server_default=sa.text("'{}'")),
        sa.Column("source_doc_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_questions_subject_id", "questions", ["subject_id"])
    op.create_index("ix_questions_difficulty", "questions", ["difficulty"])
    op.execute("CREATE INDEX ix_questions_tags ON questions USING GIN(tags)")

    # options
    op.create_table(
        "options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("option_key", sa.String(1), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint("question_id", "option_key", name="uq_option_question_key"),
    )
    op.create_index("ix_options_question_id", "options", ["question_id"])

    # test_papers
    op.create_table(
        "test_papers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("exam_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("exams.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("total_marks", sa.Numeric(8, 2), nullable=False),
        sa.Column("negative_marking_factor", sa.Numeric(4, 2), nullable=False,
                  server_default="0.25"),
        sa.Column("shuffle_questions", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
        sa.Column("shuffle_options", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # test_paper_questions
    op.create_table(
        "test_paper_questions",
        sa.Column("test_paper_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("test_papers.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("questions.id"), primary_key=True),
        sa.Column("marks", sa.Numeric(5, 2), nullable=False, server_default="4"),
        sa.Column("negative_marks", sa.Numeric(5, 2), nullable=False, server_default="1"),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("subject_section", sa.String(), nullable=True),
    )
    op.create_index("ix_tpq_test_paper_id", "test_paper_questions", ["test_paper_id"])

    # attempts
    op.create_table(
        "attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("test_paper_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("test_papers.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status",
                  postgresql.ENUM("in_progress", "submitted", "timed_out", name="attempt_status", create_type=False),
                  nullable=False, server_default="in_progress"),
        sa.Column("raw_score", sa.Numeric(8, 2), nullable=True),
        sa.Column("final_score", sa.Numeric(8, 2), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("percentile", sa.Numeric(5, 2), nullable=True),
        sa.UniqueConstraint("user_id", "test_paper_id", name="uq_attempt_user_paper"),
    )
    op.create_index("ix_attempts_user_id", "attempts", ["user_id"])
    op.create_index("ix_attempts_test_paper_id", "attempts", ["test_paper_id"])

    # attempt_answers
    op.create_table(
        "attempt_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("questions.id"), nullable=False),
        sa.Column("selected_option_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("options.id"), nullable=True),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_visited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_visited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("visit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_marked_for_review", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
        sa.Column("change_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_answer_attempt_question"),
    )
    op.create_index("ix_attempt_answers_attempt_id", "attempt_answers", ["attempt_id"])

    # attempt_subject_stats
    op.create_table(
        "attempt_subject_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("subjects.id"), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("incorrect_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unattempted_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_time_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("score", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("max_score", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.UniqueConstraint("attempt_id", "subject_id", name="uq_stats_attempt_subject"),
    )

    # leaderboard_cache
    op.create_table(
        "leaderboard_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("uuid_generate_v4()")),
        sa.Column("test_paper_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("test_papers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("data", postgresql.JSONB(), nullable=False),
    )
    op.create_index("ix_leaderboard_cache_test_paper_id", "leaderboard_cache", ["test_paper_id"])


def downgrade() -> None:
    op.drop_table("leaderboard_cache")
    op.drop_table("attempt_subject_stats")
    op.drop_table("attempt_answers")
    op.drop_table("attempts")
    op.drop_table("test_paper_questions")
    op.drop_table("test_papers")
    op.drop_table("options")
    op.drop_table("questions")
    op.drop_table("document_chunks")
    op.drop_table("documents")
    op.drop_table("topics")
    op.drop_table("subjects")
    op.drop_table("exams")
    op.drop_table("refresh_tokens")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS attempt_status")
    op.execute("DROP TYPE IF EXISTS doc_status")
    op.execute("DROP TYPE IF EXISTS difficulty_level")
    op.execute("DROP TYPE IF EXISTS user_role")
