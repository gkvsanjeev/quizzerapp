# /seed-data

Seed the database with demo data for development and testing.

## Usage
```
/seed-data
```

## What this seeds

1. **Users**: 1 admin, 2 teachers, 5 students (all password: `Test1234!`)
2. **Exam**: "JEE Main 2024 Mock" with 3 subjects (Physics, Chemistry, Math)
3. **Topics**: 5 topics per subject
4. **Questions**: 30 questions per subject (90 total, mixed difficulties)
5. **Test Paper**: "JEE Main 2024 Mock - Set 1" (3 hours, 360 marks, -1/4 negative)
6. **Demo Attempt**: One complete attempt by student1 with all 9 analysis sections populated

## Script location
`backend/scripts/seed_data.py`

Run with:
```bash
cd backend
uv run python scripts/seed_data.py
```

## Seed accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@quizzer.dev | Test1234! |
| Teacher | teacher1@quizzer.dev | Test1234! |
| Student | student1@quizzer.dev | Test1234! |

## To reset and re-seed
```bash
cd backend
uv run alembic downgrade base
uv run alembic upgrade head
uv run python scripts/seed_data.py
```

## Notes
- Seed data is for development only — never run against production DB
- The demo attempt is designed to exercise all 9 analysis sections with realistic data
- Questions include `explanation` field for Question-by-Question analysis
