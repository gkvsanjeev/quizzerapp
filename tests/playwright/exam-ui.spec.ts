import { test, expect, type Page } from '@playwright/test'

// E2E for the exam-taking UI (T035 store, T036 ExamPage, T037 QuestionDisplay,
// T038 QuestionPalette, T039 ExamTimer, T040 AttemptsPage).
// Requires the frontend on :5173 and the backend on :8000 (+ the quizzer dev DB).
// The published paper + in-progress attempt are seeded via the API (publishing
// has no UI yet); the exam interaction itself is driven through the browser.
// Auth is in-memory, so all steps share one page (serial).

const BASE = 'http://localhost:5173'
const API = 'http://localhost:8000'
const stamp = Date.now()
const STUDENT = `exam.e2e.s.${stamp}@example.com`
const TEACHER = `exam.e2e.t.${stamp}@example.com`
const PWD = 'SecurePass1!'
const PAPER_TITLE = `E2E Mock ${stamp}`

test.describe.serial('Exam taking', () => {
  let page: Page
  let attemptId: string

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    const req = page.request

    // Teacher: published exam → subject → 2 questions (option B correct) → paper.
    const teacher = await (
      await req.post(`${API}/api/auth/register`, {
        data: { email: TEACHER, name: 'T', password: PWD, role: 'teacher' },
      })
    ).json()
    const tAuth = { Authorization: `Bearer ${teacher.access_token}` }

    const exam = await (
      await req.post(`${API}/api/exams`, {
        headers: tAuth,
        data: { title: `E2E Exam ${stamp}`, exam_type: 'JEE' },
      })
    ).json()
    await req.put(`${API}/api/exams/${exam.id}`, { headers: tAuth, data: { is_published: true } })

    const subject = await (
      await req.post(`${API}/api/exams/${exam.id}/subjects`, {
        headers: tAuth,
        data: { name: 'Mechanics' },
      })
    ).json()

    const makeQuestion = async (text: string): Promise<string> => {
      const q = await (
        await req.post(`${API}/api/questions`, {
          headers: tAuth,
          data: {
            subject_id: subject.id,
            text,
            difficulty: 'easy',
            options: [
              { option_key: 'A', text: 'Option A', is_correct: false },
              { option_key: 'B', text: 'Option B', is_correct: true },
              { option_key: 'C', text: 'Option C', is_correct: false },
              { option_key: 'D', text: 'Option D', is_correct: false },
            ],
          },
        })
      ).json()
      return q.id
    }
    const q1 = await makeQuestion('What is inertia?')
    const q2 = await makeQuestion('Define acceleration.')

    const paper = await (
      await req.post(`${API}/api/exams/${exam.id}/test-papers`, {
        headers: tAuth,
        data: { title: PAPER_TITLE, duration_seconds: 3600, total_marks: 8 },
      })
    ).json()
    await req.post(`${API}/api/test-papers/${paper.id}/questions`, {
      headers: tAuth,
      data: {
        question_ids: [
          { question_id: q1, display_order: 1 },
          { question_id: q2, display_order: 2 },
        ],
      },
    })

    // Student + in-progress attempt.
    const student = await (
      await req.post(`${API}/api/auth/register`, {
        data: { email: STUDENT, name: 'S', password: PWD, role: 'student' },
      })
    ).json()
    const attempt = await (
      await req.post(`${API}/api/attempts`, {
        headers: { Authorization: `Bearer ${student.access_token}` },
        data: { test_paper_id: paper.id },
      })
    ).json()
    attemptId = attempt.attempt_id
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('T040 — student sees the in-progress attempt and resumes it', async () => {
    await page.goto(`${BASE}/login`)
    await page.locator('input[type=email]').fill(STUDENT)
    await page.locator('input[type=password]').fill(PWD)
    await page.locator('button[type=submit]').click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.locator('a[href="/attempts"]').click()
    await expect(page).toHaveURL(/\/attempts$/)
    const row = page.getByRole('row', { name: new RegExp(PAPER_TITLE) })
    await expect(row).toBeVisible()
    await expect(row.getByText('In Progress')).toBeVisible()

    await page.locator(`a[href="/exam/${attemptId}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/exam/${attemptId}$`))
  })

  test('T036-T039 — exam renders, timer runs, answering updates the palette', async () => {
    await expect(page.getByText('Question 1 of 2')).toBeVisible()
    // Timer is present and did NOT auto-submit on load.
    await expect(page.getByRole('timer')).toBeVisible()
    // Palette shows Q1 unanswered initially.
    await expect(page.getByRole('button', { name: 'Question 1, Unanswered' }).first()).toBeVisible()

    // Select option B (the correct one) — 2nd radio → palette flips to answered.
    await page.getByRole('radio').nth(1).click()
    await expect(page.getByRole('button', { name: 'Question 1, Answered' }).first()).toBeVisible()

    // Palette navigation jumps to Q2.
    await page.getByRole('button', { name: /Question 2/ }).first().click()
    await expect(page.getByText('Question 2 of 2')).toBeVisible()
  })

  test('T034/T040 — submit scores the attempt and shows it in history', async () => {
    await page.getByRole('button', { name: 'Submit Test' }).click()
    await page.getByRole('button', { name: 'Submit now' }).click()
    await expect(page).toHaveURL(/\/attempts$/)

    const row = page.getByRole('row', { name: new RegExp(PAPER_TITLE) })
    await expect(row.getByText('Submitted')).toBeVisible()
    // Q1 correct (4 marks), Q2 unanswered → score 4.
    await expect(row.getByRole('cell', { name: '4', exact: true })).toBeVisible()
    await expect(row.getByRole('link', { name: /view analysis/i })).toBeVisible()
  })
})
