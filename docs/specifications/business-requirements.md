# Business Requirements — QuizzerApp

**Feature Branch**: `main`  
**Last Updated**: 2026-06-14  
**Status**: Draft — Phase 1 complete, Phase 2 in progress  
**Input**: "Build a full-stack exam test series platform for competitive exam preparation (JEE, NEET, UPSC, GATE). Students take timed mock tests in a real computer-based exam interface and receive detailed analytics afterward. Teachers and admins create question banks and test papers, with optional AI-assisted question generation from uploaded PDFs."

---

> ⚡ **Quick Guidelines**
> - ✅ Focus on WHAT users need and WHY
> - ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
> - 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Stories

**As a student** preparing for JEE/NEET/UPSC, I want to take timed mock tests that exactly replicate the real exam interface, so I can practice under authentic conditions and identify my weaknesses through detailed analytics.

**As a teacher**, I want to build subject-specific question banks and assemble test papers from them, so my students can practice with high-quality, curriculum-aligned questions without me spending hours on formatting.

**As an admin**, I want to manage all exams, users, and published test papers from a single dashboard, so I can maintain platform quality and respond to issues quickly.

---

### Acceptance Scenarios

#### Student Scenarios

1. **Given** a student on the dashboard, **When** they click "Start Test" on a published test paper, **Then** the interface launches in full-screen mode with a countdown timer and question palette showing all question numbers

2. **Given** a student in an active exam, **When** they select an answer and navigate away, **Then** their answer is auto-saved within 10 seconds and marked as answered in the question palette

3. **Given** a student in an active exam, **When** the countdown timer reaches zero, **Then** the exam is automatically submitted with all current answers saved

4. **Given** a student who navigates to a question, marks it for review, and later returns, **Then** the question palette shows it in "marked for review" state and their original answer is preserved

5. **Given** a student who submits an exam, **When** they are redirected to the analysis page, **Then** they see an overview section showing score, rank, percentile, accuracy, and time taken within 3 seconds

6. **Given** a student on the analysis page, **When** they navigate between sections, **Then** they can view: Overview, Performance by Subject, Time Distribution, Attempt Breakdown, Difficulty Analysis, Subject Movement, Question Journey, and Question-by-Question review

7. **Given** a student who completed multiple test papers, **When** they view their dashboard, **Then** they see a history of all past attempts with scores and dates

8. **Given** a student who closed the browser mid-exam, **When** they return and click "Resume", **Then** they are placed back in the exam at the same question with their saved answers and correct remaining time

#### Teacher Scenarios

1. **Given** a teacher on the dashboard, **When** they create a new exam (e.g., "JEE Mock Test Series"), **Then** they can add subjects (Physics, Chemistry, Math) and topics under each subject

2. **Given** a teacher on the question bank page, **When** they manually add a question with 4 options and mark one correct, **Then** the question appears in the bank filtered by the subject they selected

3. **Given** a teacher who uploads a PDF of exam material, **When** the processing completes, **Then** they can request AI-generated MCQ questions from that content, specifying subject, topic, difficulty, and count

4. **Given** a teacher reviewing AI-generated questions, **When** they see the list with correct answers highlighted, **Then** they can edit question text, change the correct answer, delete unwanted questions, and save the approved ones to the bank

5. **Given** a teacher creating a test paper, **When** they select questions from the bank and configure marks/negative marks, **Then** they can schedule the paper for a specific date or publish it immediately

#### Admin Scenarios

1. **Given** an admin on the dashboard, **When** they view the user list, **Then** they can see all registered users with their roles and activation status, and can deactivate accounts

2. **Given** an admin reviewing test papers, **When** they toggle "is_published" on a paper, **Then** that paper immediately appears (or disappears) in students' available test list

3. **Given** an admin viewing the leaderboard for a test paper, **When** they open it, **Then** they see all students ranked by score with percentiles computed correctly

#### Edge Cases

- **Exam already attempted**: A student who completed a test paper cannot start it again; they are shown the analysis from their previous attempt
- **Outside time window**: If a test paper has a scheduled date, students cannot access it before that time
- **Network failure during exam**: Auto-save captures state every 10 seconds; on reconnect, the exam resumes from the last saved state with correct time remaining
- **AI generation failure**: If LLM returns malformed output, the teacher is shown an error and can retry; no partial data is saved
- **Document processing failure**: If OCR/embedding fails, the document is marked as "failed" and the teacher is notified; no partial chunks are stored

---

## Requirements

### Functional Requirements

**PRIORITY LEGEND**:
- 🔴 MVP REQUIRED — Must have for launch
- 🟡 IMPORTANT — Strong value, implement post-MVP core
- 🟢 NICE TO HAVE — Enhances UX, schedule for later

#### Authentication & Users

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Students, teachers, and admins register with email + password | 🔴 |
| AUTH-02 | Secure login returns short-lived access token + httpOnly refresh cookie | 🔴 |
| AUTH-03 | Access token auto-refreshes transparently when it expires | 🔴 |
| AUTH-04 | Users can log out, which revokes the refresh token | 🔴 |
| AUTH-05 | Role-based access: admins > teachers > students | 🔴 |
| AUTH-06 | Admin can deactivate user accounts | 🟡 |
| AUTH-07 | Password reset via email link | 🟡 |

#### Exam & Content Management

| ID | Requirement | Priority |
|---|---|---|
| EXAM-01 | Teachers/admins create exams with title, description, and type (JEE, NEET, etc.) | 🔴 |
| EXAM-02 | Exams have subjects; subjects have topics (hierarchical) | 🔴 |
| EXAM-03 | Teachers add questions to the bank with text, 4 options, correct answer, difficulty, tags | 🔴 |
| EXAM-04 | Questions support an optional image URL | 🟡 |
| EXAM-05 | Teachers filter the question bank by subject, topic, difficulty, and tags | 🔴 |
| EXAM-06 | Teachers create test papers from a question bank, assigning marks and negative marks per question | 🔴 |
| EXAM-07 | Test papers can shuffle question order and option order | 🟡 |
| EXAM-08 | Test papers have a configurable duration (seconds) | 🔴 |
| EXAM-09 | Admins publish/unpublish test papers to control student visibility | 🔴 |

#### Exam Taking

| ID | Requirement | Priority |
|---|---|---|
| TAKE-01 | Students start a published test paper, creating an attempt record | 🔴 |
| TAKE-02 | Only one attempt per student per test paper is allowed | 🔴 |
| TAKE-03 | Exam interface shows questions one at a time with A/B/C/D radio options | 🔴 |
| TAKE-04 | Question palette shows all question numbers with status (unattempted, answered, marked for review) | 🔴 |
| TAKE-05 | Countdown timer counts down from the configured duration | 🔴 |
| TAKE-06 | Answers auto-save every 10 seconds and on every answer change | 🔴 |
| TAKE-07 | Students can mark a question for review and revisit it | 🔴 |
| TAKE-08 | Exam runs in full-screen browser mode | 🟡 |
| TAKE-09 | Exam can be resumed after browser close (for remaining time) | 🔴 |
| TAKE-10 | Timer expiry triggers automatic submission | 🔴 |
| TAKE-11 | Submission records: time spent per question, visit count, answer change count | 🔴 |

#### Analysis & Reporting

| ID | Requirement | Priority |
|---|---|---|
| ANA-01 | Immediately after submission, show score overview (score, rank, percentile, accuracy, time) | 🔴 |
| ANA-02 | Performance breakdown by subject (score, correct, incorrect, unattempted per subject) | 🔴 |
| ANA-03 | Time distribution: total time, avg per question, time per subject, time per difficulty | 🔴 |
| ANA-04 | Attempt breakdown: correct, incorrect, skipped, marked-for-review counts with net score | 🔴 |
| ANA-05 | Difficulty analysis: accuracy % per difficulty level (easy/medium/hard) | 🔴 |
| ANA-06 | Subject movement: how often the student switched subjects and when | 🟡 |
| ANA-07 | Question journey: timeline of visited, answered, revisited, changed events | 🟡 |
| ANA-08 | Question-by-question table: every question with result, time, your answer vs correct | 🔴 |
| ANA-09 | Rank and percentile shown vs all students who took the same paper | 🔴 |
| ANA-10 | Topper score and average score shown in overview | 🟡 |

#### RAG / AI Question Generation

| ID | Requirement | Priority |
|---|---|---|
| RAG-01 | Teachers upload PDF files (text-based or scanned) | 🟡 |
| RAG-02 | System extracts and chunks text, generates embeddings, stores in vector DB | 🟡 |
| RAG-03 | Teachers request MCQ generation specifying subject, topic, difficulty, and count | 🟡 |
| RAG-04 | AI returns questions for human review before saving | 🟡 |
| RAG-05 | Teachers edit/delete AI-generated questions before saving | 🟡 |
| RAG-06 | Saved questions are linked to their source document | 🟡 |
| RAG-07 | Teachers can search the knowledge base with natural language | 🟢 |

---

## Key Entities

1. **User** — id, email, name, role (admin/teacher/student), password, is_active
2. **Exam** — id, title, description, exam_type, created_by, is_published
3. **Subject** — id, exam_id, name, order_index
4. **Topic** — id, subject_id, name
5. **Question** — id, subject_id, topic_id, text, image_url, difficulty, explanation, tags, source_doc_id
6. **Option** — id, question_id, option_key (A-D), text, image_url, is_correct
7. **TestPaper** — id, exam_id, title, scheduled_at, duration_seconds, total_marks, negative_marking_factor, shuffle settings
8. **TestPaperQuestion** — test_paper_id, question_id, marks, negative_marks, display_order
9. **Attempt** — id, user_id, test_paper_id, started_at, submitted_at, status, raw_score, final_score, rank, percentile
10. **AttemptAnswer** — id, attempt_id, question_id, selected_option_id, time_spent, visit_count, change_count, is_marked_for_review
11. **AttemptSubjectStats** — id, attempt_id, subject_id, correct/incorrect/skipped/unattempted counts, time, score
12. **Document** — id, filename, file_type, storage_url, processing_status
13. **DocumentChunk** — id, document_id, content, chunk_index, page_number, embedding (1536-dim vector)
14. **LeaderboardCache** — id, test_paper_id, computed_at, data (JSONB)

---

## Review Checklist

- [x] All user types covered (student, teacher, admin)
- [x] Happy path scenarios defined for each user type
- [x] Edge cases documented
- [x] Functional requirements are testable (Given/When/Then)
- [x] Key entities identified with relationships implied
- [ ] Exact business rules for negative marking formula confirmed
- [ ] Leaderboard computation timing (on submit? batch cron?) — decided: on submit
- [ ] Email notification requirements (exam results) — deferred to Phase 6
