import { test, expect, type Page } from '@playwright/test'

// E2E for the analysis dashboard (T045 layout + T046 Overview section).
// Requires the frontend on :5173 and backend on :8000 (+ quizzer dev DB).
// Seeds a submitted attempt via the API, then drives the browser:
// attempts → View Analysis → Overview (default) → a placeholder tab.

const BASE = 'http://localhost:5173'
const API = 'http://localhost:8000'
const stamp = Date.now()
const STUDENT = `analysis.e2e.${stamp}@example.com`
const TEACHER = `analysis.e2e.t.${stamp}@example.com`
const PWD = 'SecurePass1!'

test.describe.serial('Analysis dashboard', () => {
  let page: Page
  let attemptId: string

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    const req = page.request

    const teacher = await (
      await req.post(`${API}/api/auth/register`, {
        data: { email: TEACHER, name: 'T', password: PWD, role: 'teacher' },
      })
    ).json()
    const tAuth = { Authorization: `Bearer ${teacher.access_token}` }

    const exam = await (
      await req.post(`${API}/api/exams`, { headers: tAuth, data: { title: `An Exam ${stamp}`, exam_type: 'JEE' } })
    ).json()
    await req.put(`${API}/api/exams/${exam.id}`, { headers: tAuth, data: { is_published: true } })
    const subject = await (
      await req.post(`${API}/api/exams/${exam.id}/subjects`, { headers: tAuth, data: { name: 'Physics' } })
    ).json()

    const makeQ = async (text: string): Promise<string> =>
      (
        await (
          await req.post(`${API}/api/questions`, {
            headers: tAuth,
            data: {
              subject_id: subject.id,
              text,
              difficulty: 'easy',
              options: [
                { option_key: 'A', text: 'A', is_correct: false },
                { option_key: 'B', text: 'B', is_correct: true },
                { option_key: 'C', text: 'C', is_correct: false },
                { option_key: 'D', text: 'D', is_correct: false },
              ],
            },
          })
        ).json()
      ).id
    const q1 = await makeQ('Q1')
    const q2 = await makeQ('Q2')

    const paper = await (
      await req.post(`${API}/api/exams/${exam.id}/test-papers`, {
        headers: tAuth,
        data: { title: `An Paper ${stamp}`, duration_seconds: 3600, total_marks: 8 },
      })
    ).json()
    await req.post(`${API}/api/test-papers/${paper.id}/questions`, {
      headers: tAuth,
      data: { question_ids: [{ question_id: q1, display_order: 1 }, { question_id: q2, display_order: 2 }] },
    })

    const student = await (
      await req.post(`${API}/api/auth/register`, {
        data: { email: STUDENT, name: 'S', password: PWD, role: 'student' },
      })
    ).json()
    const sAuth = { Authorization: `Bearer ${student.access_token}` }
    const state = await (
      await req.post(`${API}/api/attempts`, { headers: sAuth, data: { test_paper_id: paper.id } })
    ).json()
    attemptId = state.attempt_id
    // Answer Q1 correctly (option B), submit.
    const q1opts = state.questions.find((q: { id: string }) => q.id === q1).options
    const bId = q1opts.find((o: { option_key: string }) => o.option_key === 'B').id
    await req.put(`${API}/api/attempts/${attemptId}/answer`, {
      headers: sAuth,
      data: { question_id: q1, selected_option_id: bId },
    })
    await req.post(`${API}/api/attempts/${attemptId}/submit`, { headers: sAuth })
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('opens analysis from the attempt history', async () => {
    await page.goto(`${BASE}/login`)
    await page.getByRole('textbox', { name: 'Email' }).fill(STUDENT)
    await page.getByRole('textbox', { name: 'Password' }).fill(PWD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.locator('a[href="/attempts"]').click()
    await page.locator(`a[href="/analysis/${attemptId}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/analysis/${attemptId}$`))
  })

  test('T045/T046 — Overview is the default tab and shows KPIs + gauge', async () => {
    // Overview is selected by default (no click).
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('data-state', 'active')

    // KPI values from the seeded attempt: 1 correct of 2, score 4/8.
    const overview = page.getByRole('tabpanel', { name: 'Overview' })
    await expect(overview.getByText('4 / 8')).toBeVisible()
    await expect(overview.getByRole('term').filter({ hasText: 'Accuracy' })).toBeVisible()
    // Radial gauge present.
    await expect(overview.getByRole('img', { name: /score gauge/i })).toBeVisible()
  })

  test('T047 — Performance tab shows bar chart + table', async () => {
    await page.getByRole('tab', { name: 'Performance' }).click()
    // Bar chart should be visible
    await expect(page.locator('.recharts-responsive-container')).toBeVisible()
    // Summary table should show subject data (use columnheader role for specificity)
    await expect(page.getByRole('columnheader', { name: 'Subject' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Your Score' })).toBeVisible()
  })

  test('T048 — Time tab shows histogram + pie chart + stats', async () => {
    await page.getByRole('tab', { name: 'Time' }).click()
    // Stats should be visible
    await expect(page.getByText('Total Time')).toBeVisible()
    await expect(page.getByText('Avg per Question')).toBeVisible()
    // Two charts visible (histogram + pie)
    await expect(page.locator('.recharts-responsive-container')).toHaveCount(2)
  })

  test('T049 — Attempts tab shows pie chart + waterfall chart', async () => {
    await page.getByRole('tab', { name: 'Attempts' }).click()
    // Should have pie chart for question status
    await expect(page.getByText('Question Status')).toBeVisible()
    // Should have waterfall chart for score breakdown
    await expect(page.getByText('Score Breakdown')).toBeVisible()
    // Two charts visible
    await expect(page.locator('.recharts-responsive-container')).toHaveCount(2)
  })
})
