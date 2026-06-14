import { test, expect, type Page } from '@playwright/test'

// E2E for the teacher console (T027 Exams, T028 Question Bank, T029 Test Papers).
// Requires the frontend dev server on :5173 proxying /api to the backend on :8000,
// and a reachable Postgres (the quizzer dev DB). Auth is in-memory, so all three
// flows run against a single shared page (serial) to preserve the session — a full
// page reload would drop the token and bounce to /login.

const BASE = 'http://localhost:5173'
// Unique per run so re-runs don't collide on the user/exam unique constraints.
const stamp = Date.now()
const EMAIL = `teacher.e2e.${stamp}@example.com`
const PASSWORD = 'SecurePass1!'
const EXAM_TITLE = `E2E Exam ${stamp}`
// Unique subject name so assertions don't collide with subjects in other exams
// that persist in the shared dev DB across runs.
const SUBJECT = `Physics ${stamp}`

test.describe.serial('Teacher console', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    // Register a fresh teacher → lands on /dashboard with an in-memory session.
    await page.goto(`${BASE}/register`)
    await page.getByRole('textbox', { name: 'Full name' }).fill('E2E Teacher')
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
    await page.getByPlaceholder('Min 8 characters').fill(PASSWORD)
    await page.getByRole('combobox', { name: 'I am a' }).click()
    await page.getByRole('option', { name: 'Teacher' }).click()
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('T027 — create an exam and add a subject', async () => {
    // Navigate client-side from the dashboard teacher console.
    await page.getByRole('link', { name: /^Exams/ }).click()
    await expect(page).toHaveURL(/\/teacher\/exams$/)

    // Create exam via the dialog.
    await page.getByRole('button', { name: 'Create Exam' }).click()
    const dialog = page.getByRole('dialog', { name: 'New Exam' })
    await dialog.getByRole('textbox', { name: 'Title' }).fill(EXAM_TITLE)
    await dialog.getByRole('combobox', { name: 'Select exam type' }).click()
    await page.getByRole('option', { name: 'JEE' }).click()
    await dialog.getByRole('button', { name: 'Create Exam' }).click()

    // Card appears with the exam title.
    const card = page.getByRole('heading', { name: EXAM_TITLE })
    await expect(card).toBeVisible()

    // Add a subject inline (aria-labels are scoped to this exam's title).
    await page.getByRole('textbox', { name: `Add subject to ${EXAM_TITLE}` }).fill(SUBJECT)
    await page.getByRole('button', { name: `Add subject to ${EXAM_TITLE}` }).click()
    await expect(page.getByRole('listitem').filter({ hasText: SUBJECT })).toBeVisible()
  })

  test('T028 — add a question to the question bank', async () => {
    await page.getByRole('link', { name: 'Question Bank' }).click()
    await expect(page).toHaveURL(/\/teacher\/questions$/)

    await page.getByRole('button', { name: 'Add Question' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add Question' })

    await dialog.getByRole('combobox', { name: 'Select exam' }).click()
    await page.getByRole('option', { name: EXAM_TITLE }).click()
    await dialog.getByRole('combobox', { name: 'Select subject' }).click()
    await page.getByRole('option', { name: SUBJECT }).click()
    await dialog.getByRole('combobox', { name: 'Select difficulty' }).click()
    await page.getByRole('option', { name: 'Medium' }).click()

    await dialog.getByRole('textbox', { name: 'Question Text' }).fill('What is the SI unit of force?')
    await dialog.getByRole('textbox', { name: 'Option A text' }).fill('Joule')
    await dialog.getByRole('textbox', { name: 'Option B text' }).fill('Newton')
    await dialog.getByRole('textbox', { name: 'Option C text' }).fill('Watt')
    await dialog.getByRole('textbox', { name: 'Option D text' }).fill('Pascal')
    await dialog.getByRole('radio', { name: 'Mark option B as correct' }).click()
    await dialog.getByRole('button', { name: 'Save Question' }).click()

    // Row appears; subject resolves to the name (not a raw UUID).
    const row = page.getByRole('row', { name: /What is the SI unit of force\?/ })
    await expect(row.first()).toBeVisible()
    await expect(row.first().getByRole('cell', { name: SUBJECT })).toBeVisible()
  })

  test('T029 — create a test paper through the 3-step wizard', async () => {
    await page.getByRole('link', { name: 'Test Papers' }).click()
    await expect(page).toHaveURL(/\/teacher\/test-papers$/)

    // Step 1 — settings.
    await page.getByRole('combobox', { name: 'Exam' }).click()
    await page.getByRole('option', { name: EXAM_TITLE }).click()
    await page.getByRole('textbox', { name: 'Paper Title' }).fill('E2E Mock Test 1')
    await page.getByRole('button', { name: /Next: Select Questions/ }).click()

    // Step 2 — select the question.
    await expect(page.getByRole('heading', { name: 'Select Questions' })).toBeVisible()
    await page.getByRole('checkbox', { name: /Select question: What is the SI unit/ }).click()
    await page.getByRole('button', { name: /Next: Set Marks/ }).click()

    // Step 3 — confirm & create.
    await expect(page.getByRole('heading', { name: 'Assign Marks' })).toBeVisible()
    await page.getByRole('button', { name: 'Create Test Paper' }).click()

    // On success the wizard navigates back to the exams list.
    await expect(page).toHaveURL(/\/teacher\/exams$/)
  })
})
