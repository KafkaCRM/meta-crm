import { test, expect } from '@playwright/test';

test.describe('Permissions', () => {
  test('branch_user cannot access /settings — redirected', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env['E2E_BRANCH_USER_EMAIL'] ?? 'user@test.com');
    await page.fill('#password', process.env['E2E_BRANCH_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');

    await page.goto('/settings');

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/settings');
  });

  test('branch_user cannot see delete buttons on party list', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env['E2E_BRANCH_USER_EMAIL'] ?? 'user@test.com');
    await page.fill('#password', process.env['E2E_BRANCH_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');

    await page.goto('/parties');

    const deleteButtons = page.getByRole('button', { name: /delete/i });
    await expect(deleteButtons).toHaveCount(0);
  });

  test('branch_user cannot see settings link in navigation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env['E2E_BRANCH_USER_EMAIL'] ?? 'user@test.com');
    await page.fill('#password', process.env['E2E_BRANCH_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');

    const settingsLink = page.getByRole('link', { name: /settings/i });
    await expect(settingsLink).not.toBeVisible();
  });

  test('tenant_admin can access /settings', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env['E2E_USER_EMAIL'] ?? 'admin@test.com');
    await page.fill('#password', process.env['E2E_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/branch|branches/i)).toBeVisible();
  });
});
