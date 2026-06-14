# FastAPI Patterns — QuizzerApp

## Route Organization

Each route file owns one domain. Register routers in `main.py`:

```python
from app.api.routes import auth, exams, questions, attempts, analysis, rag

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(exams.router, prefix="/api/exams", tags=["exams"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(attempts.router, prefix="/api/attempts", tags=["attempts"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
```

## Dependency Injection Pattern

```python
# deps.py
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = verify_jwt(token)
    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(401, "Not authenticated")
    return user

def require_role(*roles: str):
    async def check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return check
```

## Route Handler Pattern

```python
# Thin handler — delegates to service
@router.post("/", response_model=QuestionOut, status_code=201)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin")),
):
    return await question_service.create(db, data, current_user.id)
```

## Service Pattern

```python
# question_service.py
async def create(db: AsyncSession, data: QuestionCreate, created_by: UUID) -> Question:
    question = Question(**data.model_dump(exclude={"options"}), created_by=created_by)
    db.add(question)
    await db.flush()  # get question.id before inserting options

    for opt_data in data.options:
        option = Option(question_id=question.id, **opt_data.model_dump())
        db.add(option)

    await db.commit()
    await db.refresh(question)
    return question
```

## SQLAlchemy Async Pattern

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Eager-load relationships
stmt = (
    select(Question)
    .options(selectinload(Question.options))
    .where(Question.subject_id == subject_id)
    .order_by(Question.created_at.desc())
)
result = await db.execute(stmt)
questions = result.scalars().all()
```

## Pydantic v2 Schema Pattern

```python
from pydantic import BaseModel, ConfigDict
from uuid import UUID

class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text: str
    difficulty: str
    subject_id: UUID
    options: list[OptionOut] = []
```

## Error Handling

```python
from fastapi import HTTPException

# 404 pattern
question = await db.get(Question, question_id)
if not question:
    raise HTTPException(status_code=404, detail="Question not found")

# Ownership check
if question.created_by != current_user.id and current_user.role != "admin":
    raise HTTPException(status_code=403, detail="Forbidden")
```

## Pagination Pattern

```python
# Schema
class PaginatedOut(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int

# Usage in route
async def list_questions(page: int = 1, limit: int = 20, ...):
    offset = (page - 1) * limit
    stmt = select(Question).offset(offset).limit(limit)
    count_stmt = select(func.count()).select_from(Question)
    ...
```

## Background Tasks (for RAG processing)

```python
from fastapi import BackgroundTasks

@router.post("/upload", status_code=202)
async def upload(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    ...
):
    doc = await save_record(db, file)
    background_tasks.add_task(rag_service.process_document, doc.id)
    return {"document_id": doc.id, "status": "pending"}
```
