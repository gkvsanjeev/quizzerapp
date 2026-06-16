#!/usr/bin/env python3
"""
Database cleanup script for QuizzerApp
Keeps only user sanjiv.gkv@gmail.com and all related records,
deletes all other (dummy) data.

Deletion order is derived from the FK graph in schema.sql:
- Tables with ON DELETE CASCADE are handled automatically by Postgres.
- Only tables WITHOUT cascade need explicit deletes, in dependency order.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

TARGET_EMAIL = "sanjiv.gkv@gmail.com"

def cleanup_database():
    database_url = os.getenv(
        'DATABASE_URL',
        'postgresql+asyncpg://quizzer:quizzer_dev_pass@localhost:5432/quizzerapp'
    )
    if database_url.startswith('postgresql+asyncpg://'):
        database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')

    host_part = database_url.split('@')[-1] if '@' in database_url else database_url
    print(f"Connecting to: {host_part}")

    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        session.begin()

        # ── Resolve target user ───────────────────────────────────────────────
        row = session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": TARGET_EMAIL}
        ).fetchone()

        if not row:
            raise Exception(f"User {TARGET_EMAIL} not found!")

        uid = row[0]
        print(f"Target user ID: {uid}\n")

        # ── Helper: IDs to KEEP for each parent table ─────────────────────────
        # exams owned by target user
        KEEP_EXAMS   = "SELECT id FROM exams WHERE created_by = :uid"
        # subjects inside kept exams
        KEEP_SUBJECTS = f"SELECT id FROM subjects WHERE exam_id IN ({KEEP_EXAMS})"
        # topics inside kept subjects  (cascade would handle, but used in questions check)
        KEEP_TOPICS   = f"SELECT id FROM topics WHERE subject_id IN ({KEEP_SUBJECTS})"
        # questions inside kept subjects (subject/exam ownership is the source of truth).
        # A question created by the target user but under a foreign subject is NOT kept —
        # keeping it would leave dangling refs when the foreign subject's exam is deleted.
        KEEP_QUESTIONS = (
            f"SELECT id FROM questions WHERE subject_id IN ({KEEP_SUBJECTS})"
        )
        # test_papers belonging to kept exams (exam ownership is the source of truth).
        # A paper created by the target user but under a foreign exam is NOT kept —
        # keeping it would block deletion of that foreign exam via test_papers_exam_id_fkey.
        KEEP_TEST_PAPERS = (
            f"SELECT id FROM test_papers WHERE exam_id IN ({KEEP_EXAMS})"
        )
        # attempts made by target user AND referencing kept test_papers
        # (we keep an attempt only if BOTH the user AND the test_paper are kept)
        KEEP_ATTEMPTS = (
            f"SELECT id FROM attempts "
            f"WHERE user_id = :uid "
            f"AND test_paper_id IN ({KEEP_TEST_PAPERS})"
        )

        # ── Deletion statements in safe FK order ──────────────────────────────
        #
        # Rule: delete a row when ANY of its FK parents is being removed.
        # attempt_answers  → attempts (CASCADE), questions (no cascade), options (no cascade)
        #   options cascade from questions, so deleting foreign questions auto-removes options;
        #   but attempt_answers.selected_option_id has no cascade, so must be handled here.
        #   Simplest: delete attempt_answers whose attempt OR question is not kept.
        #
        # attempt_subject_stats → attempts (CASCADE), subjects (no cascade)
        #   Delete when attempt OR subject is not kept.
        #
        # attempts → test_papers (no cascade), users (no cascade)
        #   Delete when user != target OR test_paper not kept.
        #
        # test_paper_questions → questions (no cascade), test_papers (CASCADE)
        #   Delete when question is not kept.
        #   (test_paper cascade would handle the test_paper side, but questions side won't.)
        #
        # questions → users, subjects, topics (none cascade)
        #   Delete when not in KEEP_QUESTIONS.
        #
        # test_papers → users, exams (none cascade)
        #   Delete when not in KEEP_TEST_PAPERS.
        #
        # exams → users (no cascade)  ← cascade deletes subjects, topics auto
        #   Delete when created_by != target.
        #
        # documents → users (no cascade) ← cascade deletes document_chunks auto
        #   Delete when uploaded_by != target.
        #
        # users — delete all except target (cascade deletes refresh/password tokens).

        delete_statements = [

            # 1. attempt_answers
            #    Remove when attempt is not kept OR question is not kept.
            (f"""DELETE FROM attempt_answers
                 WHERE attempt_id  NOT IN ({KEEP_ATTEMPTS})
                    OR question_id NOT IN ({KEEP_QUESTIONS})""",
             {"uid": uid}),

            # 2. attempt_subject_stats
            #    Remove when attempt is not kept OR subject is not kept.
            (f"""DELETE FROM attempt_subject_stats
                 WHERE attempt_id NOT IN ({KEEP_ATTEMPTS})
                    OR subject_id NOT IN ({KEEP_SUBJECTS})""",
             {"uid": uid}),

            # 3. attempts
            #    Remove when user is not target OR test_paper is not kept.
            (f"""DELETE FROM attempts
                 WHERE user_id != :uid
                    OR test_paper_id NOT IN ({KEEP_TEST_PAPERS})""",
             {"uid": uid}),

            # 4. test_paper_questions
            #    Remove when question is not kept (test_paper cascade handles other side).
            (f"""DELETE FROM test_paper_questions
                 WHERE question_id NOT IN ({KEEP_QUESTIONS})""",
             {"uid": uid}),

            # 5. questions (options cascade automatically)
            (f"""DELETE FROM questions
                 WHERE id NOT IN ({KEEP_QUESTIONS})""",
             {"uid": uid}),

            # 6. test_papers (leaderboard_cache + test_paper_questions cascade automatically)
            (f"""DELETE FROM test_papers
                 WHERE id NOT IN ({KEEP_TEST_PAPERS})""",
             {"uid": uid}),

            # 7. exams (subjects → topics cascade automatically)
            ("DELETE FROM exams WHERE created_by != :uid",
             {"uid": uid}),

            # 8. documents (document_chunks cascade automatically)
            ("DELETE FROM documents WHERE uploaded_by != :uid",
             {"uid": uid}),

            # 9. users — keep only target (refresh_tokens + password_reset_tokens cascade)
            ("DELETE FROM users WHERE email != :email",
             {"email": TARGET_EMAIL}),
        ]

        total_deleted = 0
        for stmt, params in delete_statements:
            result = session.execute(text(stmt), params)
            n = result.rowcount
            total_deleted += n
            # Extract table name for display
            table = stmt.strip().split()[2]
            print(f"  Deleted {n:>6} rows from {table}")

        session.commit()
        print(f"\n✅ Cleanup complete — {total_deleted} rows deleted total")
        print(f"👤 Preserved: {TARGET_EMAIL} and all related records")

        # VACUUM must run outside any transaction with autocommit
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("VACUUM FULL ANALYZE"))
        print("🧹 VACUUM FULL ANALYZE done")

    except Exception as e:
        session.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    cleanup_database()