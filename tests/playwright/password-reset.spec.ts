import { test, expect } from '@playwright/test'

// E2E for the Forgot Password flow (T071).
// Requires the frontend dev server (:5173) proxying /api → backend (:8000).
// The emailed reset token can't be read in-browser, so the full reset happy
// path is covered by backend contract tests (test_password_reset_api.py); here
// we verify the UI flows: navigation, validation, confirmation, error states.

const BASE = 'http://localhost:5173'

test('login page links to forgot-password', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.getByRole('link', { name: /forgot password/i }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible()
})

test('forgot-password rejects an invalid email', async ({ page }) => {
  await page.goto(`${BASE}/forgot-password`)
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: /send reset link/i }).click()
  await expect(page.getByText(/enter a valid email/i)).toBeVisible()
})

test('forgot-password shows a neutral confirmation (no enumeration)', async ({ page }) => {
  await page.goto(`${BASE}/forgot-password`)
  await page.getByLabel('Email').fill('whoever@example.com')
  await page.getByRole('button', { name: /send reset link/i }).click()
  // Same message regardless of whether the account exists.
  await expect(page.getByText(/a reset link is on its way/i)).toBeVisible()
})

test('reset-password without a token shows an invalid-link message', async ({ page }) => {
  await page.goto(`${BASE}/reset-password`)
  await expect(page.getByRole('heading', { name: /invalid reset link/i })).toBeVisible()
  await page.getByRole('link', { name: /request a new link/i }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
})

test('reset-password validates matching passwords', async ({ page }) => {
  await page.goto(`${BASE}/reset-password?token=dummy-token`)
  await page.getByLabel('New password').fill('BrandNewPass9!')
  await page.getByLabel('Confirm password').fill('Mismatch9!')
  await page.getByRole('button', { name: /update password/i }).click()
  await expect(page.getByText(/passwords do not match/i)).toBeVisible()
})

test('reset-password surfaces an invalid/expired token error from the API', async ({ page }) => {
  await page.goto(`${BASE}/reset-password?token=definitely-not-a-real-token`)
  await page.getByLabel('New password').fill('BrandNewPass9!')
  await page.getByLabel('Confirm password').fill('BrandNewPass9!')
  await page.getByRole('button', { name: /update password/i }).click()
  await expect(page.getByText(/invalid or has expired|invalid or expired/i)).toBeVisible()
})
