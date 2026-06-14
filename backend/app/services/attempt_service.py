from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, Subject, Topic
from app.models.question import Option, Question
from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus, AttemptSubjectStats
from app.models.test_paper import TestPaper, TestPaperQuestion
from app.schemas.attempt import (
    AnswerStateOut,
    AnswerUpdate,
    AttemptResultOut,
    AttemptStateOut,
    OptionStudentOut,
    QuestionStudentOut,
    TestPaperBrief,
)


# ─── Lookups ────────────────────────────────────────────
async def get_paper_with_exam(db: AsyncSession, paper_id: UUID) -> tuple[TestPaper, Exam] | None:
    stmt = (
        select(TestPaper, Exam)
        .join(Exam, TestPaper.exam_id == Exam.id)
        .where(TestPaper.id == paper_id)
    )
    row = (await db.execute(stmt)).first()
    return (row[0], row[1]) if row else None


async def get_attempt(db: AsyncSession, attempt_id: UUID) -> Attempt | None:
    return (
        await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    ).scalar_one_or_none()


async def find_attempt(db: AsyncSession, user_id: UUID, paper_id: UUID) -> Attempt | None:
    stmt = select(Attempt).where(
        Attempt.user_id == user_id, Attempt.test_paper_id == paper_id
    )
    return (await db.execute(stmt)).scalar_one_or_none()


# ─── Start / resume ─────────────────────────────────────
async def create_attempt(db: AsyncSession, user_id: UUID, paper_id: UUID) -> Attempt:
    attempt = Attempt(user_id=user_id, test_paper_id=paper_id)
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)  # populate server-default started_at
    return attempt


async def _paper_questions(db: AsyncSession, paper_id: UUID) -> list[QuestionStudentOut]:
    """Ordered student-facing questions for a paper (no answer key)."""
    stmt = (
        select(Question, Subject.name, Topic.name)
        .join(TestPaperQuestion, TestPaperQuestion.question_id == Question.id)
        .join(Subject, Question.subject_id == Subject.id)
        .outerjoin(Topic, Question.topic_id == Topic.id)
        .where(TestPaperQuestion.test_paper_id == paper_id)
        .order_by(TestPaperQuestion.display_order)
        .options(selectinload(Question.options))
    )
    rows = (await db.execute(stmt)).all()
    questions: list[QuestionStudentOut] = []
    for question, subject_name, topic_name in rows:
        options = sorted(question.options, key=lambda o: o.option_key)
        questions.append(
            QuestionStudentOut(
                id=question.id,
                text=question.text,
                image_url=question.image_url,
                difficulty=question.difficulty.value,
                subject=subject_name,
                topic=topic_name,
                options=[OptionStudentOut.model_validate(o) for o in options],
            )
        )
    return questions


async def _answers_map(db: AsyncSession, attempt_id: UUID) -> dict[str, AnswerStateOut]:
    rows = (
        await db.execute(select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id))
    ).scalars().all()
    return {
        str(a.question_id): AnswerStateOut(
            selected_option_id=a.selected_option_id,
            is_marked_for_review=a.is_marked_for_review,
            visit_count=a.visit_count,
        )
        for a in rows
    }


async def build_state(db: AsyncSession, attempt: Attempt, paper: TestPaper) -> AttemptStateOut:
    elapsed = int((datetime.now(timezone.utc) - attempt.started_at).total_seconds())
    return AttemptStateOut(
        attempt_id=attempt.id,
        test_paper=TestPaperBrief.model_validate(paper),
        questions=await _paper_questions(db, paper.id),
        answers=await _answers_map(db, attempt.id),
        started_at=attempt.started_at,
        time_elapsed_seconds=max(0, elapsed),
    )


# ─── Auto-save ──────────────────────────────────────────
async def save_answer(db: AsyncSession, attempt_id: UUID, data: AnswerUpdate) -> None:
    existing = (
        await db.execute(
            select(AttemptAnswer).where(
                AttemptAnswer.attempt_id == attempt_id,
                AttemptAnswer.question_id == data.question_id,
            )
        )
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if existing is None:
        db.add(
            AttemptAnswer(
                attempt_id=attempt_id,
                question_id=data.question_id,
                selected_option_id=data.selected_option_id,
                time_spent_seconds=max(0, data.time_spent_delta_seconds),
                is_marked_for_review=bool(data.is_marked_for_review),
                visit_count=1,
                first_visited_at=now,
                last_visited_at=now,
            )
        )
    else:
        if existing.selected_option_id != data.selected_option_id:
            existing.change_count += 1
        existing.selected_option_id = data.selected_option_id
        existing.time_spent_seconds += max(0, data.time_spent_delta_seconds)
        existing.visit_count += 1
        existing.last_visited_at = now
        if data.is_marked_for_review is not None:
            existing.is_marked_for_review = data.is_marked_for_review

    await db.commit()


# ─── Submit ─────────────────────────────────────────────
async def submit_attempt(db: AsyncSession, attempt: Attempt) -> AttemptResultOut:
    paper_id = attempt.test_paper_id

    # Paper questions with their marks.
    tpqs = (
        await db.execute(
            select(TestPaperQuestion).where(TestPaperQuestion.test_paper_id == paper_id)
        )
    ).scalars().all()
    question_ids = [t.question_id for t in tpqs]

    # Correct option per question + each question's subject.
    correct_by_q: dict[UUID, UUID] = {}
    subject_by_q: dict[UUID, UUID] = {}
    if question_ids:
        opt_rows = (
            await db.execute(
                select(Option.question_id, Option.id).where(
                    Option.question_id.in_(question_ids), Option.is_correct.is_(True)
                )
            )
        ).all()
        correct_by_q = {qid: oid for qid, oid in opt_rows}
        subj_rows = (
            await db.execute(
                select(Question.id, Question.subject_id).where(Question.id.in_(question_ids))
            )
        ).all()
        subject_by_q = {qid: sid for qid, sid in subj_rows}

    # Student's answers.
    answers = (
        await db.execute(select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt.id))
    ).scalars().all()
    answer_by_q = {a.question_id: a for a in answers}

    raw_score = Decimal("0")
    penalty = Decimal("0")
    correct = incorrect = attempted = 0

    # Per-subject accumulators.
    stats: dict[UUID, dict] = {}

    def _bucket(subject_id: UUID) -> dict:
        return stats.setdefault(
            subject_id,
            {"correct": 0, "incorrect": 0, "unattempted": 0, "time": 0, "score": Decimal("0"), "max": Decimal("0")},
        )

    for tpq in tpqs:
        subject_id = subject_by_q.get(tpq.question_id)
        bucket = _bucket(subject_id) if subject_id else None
        if bucket is not None:
            bucket["max"] += tpq.marks
        ans = answer_by_q.get(tpq.question_id)
        if bucket is not None and ans is not None:
            bucket["time"] += ans.time_spent_seconds

        if ans is None or ans.selected_option_id is None:
            if bucket is not None:
                bucket["unattempted"] += 1
            continue

        attempted += 1
        if ans.selected_option_id == correct_by_q.get(tpq.question_id):
            correct += 1
            raw_score += tpq.marks
            if bucket is not None:
                bucket["correct"] += 1
                bucket["score"] += tpq.marks
        else:
            incorrect += 1
            penalty += tpq.negative_marks
            if bucket is not None:
                bucket["incorrect"] += 1
                bucket["score"] -= tpq.negative_marks

    final_score = raw_score - penalty

    attempt.status = AttemptStatus.submitted
    attempt.submitted_at = datetime.now(timezone.utc)
    attempt.raw_score = raw_score
    attempt.final_score = final_score

    for subject_id, b in stats.items():
        db.add(
            AttemptSubjectStats(
                attempt_id=attempt.id,
                subject_id=subject_id,
                correct_count=b["correct"],
                incorrect_count=b["incorrect"],
                skipped_count=0,
                unattempted_count=b["unattempted"],
                total_time_seconds=b["time"],
                score=b["score"],
                max_score=b["max"],
            )
        )
    await db.commit()

    rank, percentile = await _rank_and_percentile(db, paper_id, final_score)
    attempt.rank = rank
    attempt.percentile = percentile
    await db.commit()

    return AttemptResultOut(
        attempt_id=attempt.id,
        raw_score=raw_score,
        final_score=final_score,
        rank=rank,
        percentile=percentile,
        total_questions=len(tpqs),
        attempted=attempted,
        correct=correct,
        incorrect=incorrect,
    )


async def _rank_and_percentile(
    db: AsyncSession, paper_id: UUID, my_score: Decimal
) -> tuple[int, Decimal]:
    rows = (
        await db.execute(
            select(Attempt.final_score).where(
                Attempt.test_paper_id == paper_id,
                Attempt.status == AttemptStatus.submitted,
            )
        )
    ).all()
    scores = [r[0] for r in rows if r[0] is not None]
    total = len(scores)
    if total == 0:
        return 1, Decimal("0")
    higher = sum(1 for s in scores if s > my_score)
    lower = sum(1 for s in scores if s < my_score)
    rank = higher + 1
    percentile = Decimal(round((lower / total) * 100, 2))
    return rank, percentile


# ─── List ───────────────────────────────────────────────
async def list_attempts(
    db: AsyncSession,
    *,
    user_id: UUID,
    test_paper_id: UUID | None = None,
) -> list[tuple[Attempt, str]]:
    """Returns (attempt, test_paper_title) tuples for the user's attempts."""
    stmt = (
        select(Attempt, TestPaper.title)
        .join(TestPaper, Attempt.test_paper_id == TestPaper.id)
        .where(Attempt.user_id == user_id)
    )
    if test_paper_id is not None:
        stmt = stmt.where(Attempt.test_paper_id == test_paper_id)
    stmt = stmt.order_by(Attempt.started_at.desc())
    rows = (await db.execute(stmt)).all()
    return [(row[0], row[1]) for row in rows]
