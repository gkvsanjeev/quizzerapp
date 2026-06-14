import { test, expect } from '@playwright/test'

// E2E for the Login + Register pages (shadcn/ui enhancement of T011).
// Requires the frontend dev server (:5173). The authenticated happy path
// (submit → token → /dashboard) needs the backend (:8000) and is covered by
// auth contract tests; here we verify the UI: rendering, react-hook-form + Zod
// validation via FormMessage, the password show/hide toggle, and the accessible
// role Select on Register.

const BASE = 'http://localhost:5173'

test.describe('Login page', () => {
  test('renders and links to register + forgot-password', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    await expect(page.getByRole('link', { name: /create one/i })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  test('shows validation messages on empty submit', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByText(/enter a valid email/i)).toBeVisible()
    await expect(page.getByText(/password is required/i)).toBeVisible()
  })

  test('password show/hide toggle switches the input type', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const password = page.getByPlaceholder('Your password')
    await password.fill('secret123')
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: /show password/i }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: /hide password/i }).click()
    await expect(password).toHaveAttribute('type', 'password')
  })
})

test.describe('Register page', () => {
  test('renders all fields and links to login', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible()
    await expect(page.getByLabel('Full name')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel(/^password$/i)).toBeVisible()
    await expect(page.getByRole('combobox', { name: /i am a/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })

  test('shows validation messages on empty submit', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    await page.getByRole('button', { name: /create account/i }).click()
    // Each field surfaces its Zod message via FormMessage.
    await expect(page.getByText(/name must be at least 2 characters/i)).toBeVisible()
    await expect(page.getByText(/enter a valid email/i)).toBeVisible()
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible()
  })

  test('role Select defaults to Student and updates to Teacher', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    const role = page.getByRole('combobox', { name: /i am a/i })
    await expect(role).toContainText('Student')
    await role.click()
    await page.getByRole('option', { name: 'Teacher' }).click()
    await expect(role).toContainText('Teacher')
  })

  test('typing does not trigger a controlled-input React warning', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto(`${BASE}/register`)
    await page.getByLabel('Full name').fill('Alice Sharma')
    await page.getByLabel('Email').fill('alice@example.com')
    await page.getByPlaceholder('Min 8 characters').fill('secret123')
    expect(errors.filter((e) => /uncontrolled input to be controlled/i.test(e))).toEqual([])
  })
})
