import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', process.env['E2E_USER_EMAIL'] ?? 'admin@test.com');
    await page.fill('#password', process.env['E2E_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Meta CRM')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', 'wrong@test.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText('INVALID_CREDENTIALS')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env['E2E_USER_EMAIL'] ?? 'admin@test.com');
    await page.fill('#password', process.env['E2E_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: /sign out|logout/i }).click();
    await expect(page).toHaveURL('/login');
  });
});
