"""Analysis service — computes the 9 post-exam analysis datasets on-the-fly
from attempt_answers + the paper's questions, plus compute_subject_stats which
is run synchronously on submit (T034 calls this)."""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus, AttemptSubjectStats
from app.models.exam import Subject, Topic
from app.models.question import Option, Question
from app.models.test_paper import TestPaper, TestPaperQuestion
from app.models.user import User
from app.schemas.analysis import (
    AttemptsBreakdownOut,
    DifficultyBucket,
    DifficultyOut,
    JourneyEntry,
    OverviewOut,
    PerformanceOut,
    QuestionDetailOption,
    QuestionDetailOut,
    QuestionJourneyOut,
    QuestionListItem,
    QuestionListOut,
    QuestionTime,
    SubjectMovementOut,
    SubjectPerformance,
    SubjectTime,
    SubjectTransition,
    TimeByDifficulty,
    TimeInSubject,
    TimeOut,
)


# ─── Per-question computed record ───────────────────────
@dataclass
class QRecord:
    question_id: UUID
    number: int
    text: str
    difficulty: str
    explanation: str | None
    subject_id: UUID
    subject_name: str
    topic_name: str | None
    marks: Decimal
    negative_marks: Decimal
    options: list[Option]
    correct_option_id: UUID | None
    correct_key: str | None
    answer: AttemptAnswer | None

    @property
    def selected_option_id(self) -> UUID | None:
        return self.answer.selected_option_id if self.answer else None

    @property
    def your_key(self) -> str | None:
        sid = self.selected_option_id
        if sid is None:
            return None
        for o in self.options:
            if o.id == sid:
                return o.option_key
        return None

    @property
    def is_correct(self) -> bool:
        return self.selected_option_id is not None and self.selected_option_id == self.correct_option_id

    @property
    def result(self) -> str:
        if self.selected_option_id is None:
            return "unattempted"
        return "correct" if self.is_correct else "incorrect"

    @property
    def time_spent(self) -> int:
        return self.answer.time_spent_seconds if self.answer else 0


@dataclass
class AnalysisContext:
    attempt: Attempt
    paper: TestPaper
    records: list[QRecord]
    started_at: datetime


# ─── Loading ────────────────────────────────────────────
async def get_attempt(db: AsyncSession, attempt_id: UUID) -> Attempt | None:
    return (await db.execute(select(Attempt).where(Attempt.id == attempt_id))).scalar_one_or_none()


async def authorize(db: AsyncSession, attempt: Attempt, user: User) -> bool:
    """Owner, admin, or the teacher who created the attempt's test paper."""
    if attempt.user_id == user.id or user.role.value == "admin":
        return True
    if user.role.value == "teacher":
        creator = (
            await db.execute(
                select(TestPaper.created_by).where(TestPaper.id == attempt.test_paper_id)
            )
        ).scalar_one_or_none()
        return creator == user.id
    return False


async def load_context(db: AsyncSession, attempt: Attempt) -> AnalysisContext:
    paper = (
        await db.execute(select(TestPaper).where(TestPaper.id == attempt.test_paper_id))
    ).scalar_one()

    rows = (
        await db.execute(
            select(TestPaperQuestion, Question, Subject.name, Topic.name)
            .join(Question, TestPaperQuestion.question_id == Question.id)
            .join(Subject, Question.subject_id == Subject.id)
            .outerjoin(Topic, Question.topic_id == Topic.id)
            .where(TestPaperQuestion.test_paper_id == paper.id)
            .order_by(TestPaperQuestion.display_order)
            .options(selectinload(Question.options))
        )
    ).all()

    answers = (
        await db.execute(select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt.id))
    ).scalars().all()
    answer_by_q = {a.question_id: a for a in answers}

    records: list[QRecord] = []
    for tpq, question, subject_name, topic_name in rows:
        correct = next((o for o in question.options if o.is_correct), None)
        records.append(
            QRecord(
                question_id=question.id,
                number=tpq.display_order,
                text=question.text,
                difficulty=question.difficulty.value,
                explanation=question.explanation,
                subject_id=question.subject_id,
                subject_name=subject_name,
                topic_name=topic_name,
                marks=tpq.marks,
                negative_marks=tpq.negative_marks,
                options=list(question.options),
                correct_option_id=correct.id if correct else None,
                correct_key=correct.option_key if correct else None,
                answer=answer_by_q.get(question.id),
            )
        )
    return AnalysisContext(attempt=attempt, paper=paper, records=records, started_at=attempt.started_at)


def _offset(ctx: AnalysisContext, ts: datetime | None) -> int:
    if ts is None:
        return 0
    return max(0, int((ts - ctx.started_at).total_seconds()))


# ─── compute_subject_stats (run on submit) ──────────────
async def compute_subject_stats(db: AsyncSession, attempt: Attempt) -> None:
    """Recompute and persist attempt_subject_stats for an attempt. Idempotent."""
    ctx = await load_context(db, attempt)

    @dataclass
    class _Bucket:
        correct: int = 0
        incorrect: int = 0
        unattempted: int = 0
        time: int = 0
        score: Decimal = field(default_factory=lambda: Decimal("0"))
        max_score: Decimal = field(default_factory=lambda: Decimal("0"))

    buckets: dict[UUID, _Bucket] = {}
    for r in ctx.records:
        b = buckets.setdefault(r.subject_id, _Bucket())
        b.max_score += r.marks
        b.time += r.time_spent
        if r.result == "correct":
            b.correct += 1
            b.score += r.marks
        elif r.result == "incorrect":
            b.incorrect += 1
            b.score -= r.negative_marks
        else:
            b.unattempted += 1

    await db.execute(
        delete(AttemptSubjectStats).where(AttemptSubjectStats.attempt_id == attempt.id)
    )
    for subject_id, b in buckets.items():
        db.add(
            AttemptSubjectStats(
                attempt_id=attempt.id,
                subject_id=subject_id,
                correct_count=b.correct,
                incorrect_count=b.incorrect,
                skipped_count=0,
                unattempted_count=b.unattempted,
                total_time_seconds=b.time,
                score=b.score,
                max_score=b.max_score,
            )
        )
    await db.commit()


# ─── Cross-attempt aggregates ───────────────────────────
async def _paper_score_aggregates(db: AsyncSession, paper_id: UUID) -> tuple[float | None, float | None]:
    row = (
        await db.execute(
            select(func.max(Attempt.final_score), func.avg(Attempt.final_score)).where(
                Attempt.test_paper_id == paper_id, Attempt.status == AttemptStatus.submitted
            )
        )
    ).first()
    top = float(row[0]) if row and row[0] is not None else None
    avg = round(float(row[1]), 2) if row and row[1] is not None else None
    return top, avg


async def _subject_score_aggregates(db: AsyncSession, paper_id: UUID) -> dict[UUID, tuple[float, float]]:
    rows = (
        await db.execute(
            select(
                AttemptSubjectStats.subject_id,
                func.max(AttemptSubjectStats.score),
                func.avg(AttemptSubjectStats.score),
            )
            .join(Attempt, AttemptSubjectStats.attempt_id == Attempt.id)
            .where(Attempt.test_paper_id == paper_id, Attempt.status == AttemptStatus.submitted)
            .group_by(AttemptSubjectStats.subject_id)
        )
    ).all()
    return {sid: (float(top), round(float(avg), 2)) for sid, top, avg in rows}


# ─── Getters (one per endpoint) ─────────────────────────
async def get_overview(db: AsyncSession, ctx: AnalysisContext) -> OverviewOut:
    correct = sum(1 for r in ctx.records if r.result == "correct")
    incorrect = sum(1 for r in ctx.records if r.result == "incorrect")
    unattempted = sum(1 for r in ctx.records if r.result == "unattempted")
    attempted = correct + incorrect
    total = len(ctx.records)
    max_score = float(sum((r.marks for r in ctx.records), Decimal("0")))
    score = float(ctx.attempt.final_score or 0)
    time_taken = sum(r.time_spent for r in ctx.records)
    top, avg = await _paper_score_aggregates(db, ctx.paper.id)
    return OverviewOut(
        score=score,
        max_score=max_score,
        percentage=round(score / max_score * 100, 1) if max_score else 0.0,
        rank=ctx.attempt.rank,
        percentile=float(ctx.attempt.percentile) if ctx.attempt.percentile is not None else None,
        total_questions=total,
        attempted=attempted,
        correct=correct,
        incorrect=incorrect,
        unattempted=unattempted,
        accuracy_percentage=round(correct / attempted * 100, 1) if attempted else 0.0,
        time_taken_seconds=time_taken,
        duration_seconds=ctx.paper.duration_seconds,
        topper_score=top,
        average_score=avg,
    )


async def get_performance(db: AsyncSession, ctx: AnalysisContext) -> PerformanceOut:
    subj_aggs = await _subject_score_aggregates(db, ctx.paper.id)

    by_subject: dict[UUID, dict] = {}
    for r in ctx.records:
        s = by_subject.setdefault(r.subject_id, {"name": r.subject_name, "score": Decimal("0"), "max": Decimal("0")})
        s["max"] += r.marks
        if r.result == "correct":
            s["score"] += r.marks
        elif r.result == "incorrect":
            s["score"] -= r.negative_marks

    subjects = []
    for sid, s in by_subject.items():
        score = float(s["score"])
        max_score = float(s["max"])
        top, avg = subj_aggs.get(sid, (None, None))
        subjects.append(
            SubjectPerformance(
                name=s["name"],
                score=score,
                max_score=max_score,
                percentage=round(score / max_score * 100, 1) if max_score else 0.0,
                topper_score=top,
                average_score=avg,
            )
        )
    return PerformanceOut(subjects=subjects)


def get_time(ctx: AnalysisContext) -> TimeOut:
    total_time = sum(r.time_spent for r in ctx.records)
    total_q = len(ctx.records)

    subj_time: dict[str, int] = {}
    diff_time = {"easy": 0, "medium": 0, "hard": 0}
    questions: list[QuestionTime] = []
    for r in ctx.records:
        subj_time[r.subject_name] = subj_time.get(r.subject_name, 0) + r.time_spent
        diff_time[r.difficulty] += r.time_spent
        questions.append(
            QuestionTime(
                question_id=r.question_id,
                time_seconds=r.time_spent,
                difficulty=r.difficulty,
                result=r.result,
            )
        )
    return TimeOut(
        total_time_seconds=total_time,
        avg_time_per_question_seconds=round(total_time / total_q) if total_q else 0,
        subjects=[SubjectTime(name=n, time_seconds=t) for n, t in subj_time.items()],
        difficulty=TimeByDifficulty(**diff_time),
        questions=questions,
    )


def get_attempts_breakdown(ctx: AnalysisContext) -> AttemptsBreakdownOut:
    correct = sum(1 for r in ctx.records if r.result == "correct")
    incorrect = sum(1 for r in ctx.records if r.result == "incorrect")
    unattempted = sum(1 for r in ctx.records if r.result == "unattempted")
    marked = sum(1 for r in ctx.records if r.answer and r.answer.is_marked_for_review)
    gross = float(sum((r.marks for r in ctx.records if r.result == "correct"), Decimal("0")))
    negative = float(sum((r.negative_marks for r in ctx.records if r.result == "incorrect"), Decimal("0")))
    return AttemptsBreakdownOut(
        correct=correct,
        incorrect=incorrect,
        skipped=0,
        unattempted=unattempted,
        marked_for_review=marked,
        net_score=gross - negative,
        gross_score=gross,
        negative_marks=negative,
    )


def get_difficulty(ctx: AnalysisContext) -> DifficultyOut:
    buckets = {d: {"total": 0, "correct": 0, "incorrect": 0, "unattempted": 0} for d in ("easy", "medium", "hard")}
    for r in ctx.records:
        b = buckets[r.difficulty]
        b["total"] += 1
        b[r.result] += 1

    def _bucket(d: str) -> DifficultyBucket:
        b = buckets[d]
        return DifficultyBucket(
            total=b["total"],
            correct=b["correct"],
            incorrect=b["incorrect"],
            unattempted=b["unattempted"],
            accuracy=round(b["correct"] / b["total"] * 100, 1) if b["total"] else 0.0,
        )

    return DifficultyOut(easy=_bucket("easy"), medium=_bucket("medium"), hard=_bucket("hard"))


def get_subject_movement(ctx: AnalysisContext) -> SubjectMovementOut:
    # Order visited questions by first_visited_at.
    visited = [r for r in ctx.records if r.answer and r.answer.first_visited_at]
    visited.sort(key=lambda r: r.answer.first_visited_at)  # type: ignore[union-attr]

    transitions: list[SubjectTransition] = []
    prev: QRecord | None = None
    for r in visited:
        if prev is not None and prev.subject_name != r.subject_name:
            transitions.append(
                SubjectTransition(
                    from_subject=prev.subject_name,
                    to_subject=r.subject_name,
                    at_question_number=r.number,
                    at_time_seconds=_offset(ctx, r.answer.first_visited_at),  # type: ignore[union-attr]
                )
            )
        prev = r

    # Time per subject + number of contiguous visit runs.
    time_by_subject: dict[str, int] = {}
    runs: dict[str, int] = {}
    last_subject: str | None = None
    for r in ctx.records:
        time_by_subject[r.subject_name] = time_by_subject.get(r.subject_name, 0) + r.time_spent
    for r in visited:
        if r.subject_name != last_subject:
            runs[r.subject_name] = runs.get(r.subject_name, 0) + 1
            last_subject = r.subject_name

    time_in_subject = [
        TimeInSubject(subject=name, total_seconds=secs, visit_count=runs.get(name, 0))
        for name, secs in time_by_subject.items()
    ]
    return SubjectMovementOut(transitions=transitions, time_in_subject=time_in_subject)


def get_question_journey(ctx: AnalysisContext) -> QuestionJourneyOut:
    events: list[JourneyEntry] = []
    answered = [r for r in ctx.records if r.answer]
    answered.sort(key=lambda r: (r.answer.first_visited_at or ctx.started_at))  # type: ignore[union-attr]
    for r in answered:
        a = r.answer
        assert a is not None
        first = _offset(ctx, a.first_visited_at)
        last = _offset(ctx, a.last_visited_at)
        events.append(JourneyEntry(question_id=r.question_id, question_number=r.number, event="visited", timestamp_seconds=first))
        if a.selected_option_id is not None:
            events.append(JourneyEntry(question_id=r.question_id, question_number=r.number, event="answered", timestamp_seconds=first))
        if a.is_marked_for_review:
            events.append(JourneyEntry(question_id=r.question_id, question_number=r.number, event="marked_for_review", timestamp_seconds=first))
        if a.visit_count > 1:
            events.append(JourneyEntry(question_id=r.question_id, question_number=r.number, event="revisited", timestamp_seconds=last))
        if a.change_count > 0:
            events.append(JourneyEntry(question_id=r.question_id, question_number=r.number, event="answer_changed", timestamp_seconds=last))
    events.sort(key=lambda e: e.timestamp_seconds)
    return QuestionJourneyOut(events=events)


def get_question_detail(ctx: AnalysisContext, question_id: UUID) -> QuestionDetailOut | None:
    r = next((r for r in ctx.records if r.question_id == question_id), None)
    if r is None:
        return None
    a = r.answer
    return QuestionDetailOut(
        question_id=r.question_id,
        question_number=r.number,
        text=r.text,
        difficulty=r.difficulty,
        subject=r.subject_name,
        topic=r.topic_name,
        your_answer=r.your_key,
        correct_answer=r.correct_key,
        is_correct=r.is_correct,
        time_spent_seconds=r.time_spent,
        visit_count=a.visit_count if a else 0,
        change_count=a.change_count if a else 0,
        is_marked_for_review=a.is_marked_for_review if a else False,
        explanation=r.explanation,
        options=[
            QuestionDetailOption(
                option_key=o.option_key,
                text=o.text,
                is_correct=o.is_correct,
                selected=o.id == r.selected_option_id,
            )
            for o in sorted(r.options, key=lambda o: o.option_key)
        ],
    )


def get_question_list(
    ctx: AnalysisContext,
    *,
    subject_id: UUID | None = None,
    result: str | None = None,
) -> QuestionListOut:
    items: list[QuestionListItem] = []
    for r in ctx.records:
        if subject_id is not None and r.subject_id != subject_id:
            continue
        if result is not None and r.result != result:
            continue
        items.append(
            QuestionListItem(
                question_id=r.question_id,
                question_number=r.number,
                subject=r.subject_name,
                topic=r.topic_name,
                difficulty=r.difficulty,
                your_answer=r.your_key,
                correct_answer=r.correct_key,
                is_correct=r.is_correct,
                time_spent_seconds=r.time_spent,
                result=r.result,
            )
        )
    return QuestionListOut(questions=items)
