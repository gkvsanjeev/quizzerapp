# /add-question

Add a new MCQ question with options to a subject in the QuizzerApp question bank.

## Usage
```
/add-question
```

## What this does

1. Ask me for:
   - Subject (name or ID)
   - Topic (optional)
   - Question text
   - 4 options (A/B/C/D) and which is correct
   - Difficulty (easy/medium/hard)
   - Explanation (optional)
   - Tags (optional, comma-separated)

2. Call `POST /api/questions` with a teacher/admin JWT token.

3. Confirm the question was saved and show its ID.

## Required context
- Backend running at `VITE_API_BASE_URL` (default: `http://localhost:8000`)
- Valid teacher/admin access token

## Steps
1. Look up the subject by name if ID not provided: `GET /api/exams` then find the subject
2. Construct the request body matching `QuestionCreate` schema in `backend/app/schemas/question.py`
3. POST to `/api/questions`
4. Display: question ID, subject, topic, difficulty

## Example body
```json
{
  "subject_id": "uuid-here",
  "topic_id": "uuid-here",
  "text": "A body is thrown vertically upward with velocity u. The maximum height reached is:",
  "difficulty": "medium",
  "explanation": "Using v² = u² - 2gh, at max height v=0, so h = u²/2g",
  "tags": ["kinematics", "projectile"],
  "options": [
    { "option_key": "A", "text": "u/g", "is_correct": false },
    { "option_key": "B", "text": "u²/2g", "is_correct": true },
    { "option_key": "C", "text": "2u/g", "is_correct": false },
    { "option_key": "D", "text": "u²/g", "is_correct": false }
  ]
}
```
