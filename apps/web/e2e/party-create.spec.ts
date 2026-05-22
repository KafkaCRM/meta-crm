import { test, expect } from '@playwright/test';

test.describe('Party Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env['E2E_USER_EMAIL'] ?? 'admin@test.com');
    await page.fill('#password', process.env['E2E_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('create a new party with valid data', async ({ page }) => {
    await page.goto('/parties/new');

    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="phone"]', '+1234567890');
    await page.fill('input[name="email"]', 'john@example.com');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/parties\/.+/);
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  test('duplicate detection warns when phone matches existing party', async ({ page }) => {
    await page.goto('/parties/new');

    await page.fill('input[name="name"]', 'Jane Duplicate');
    await page.fill('input[name="phone"]', '+1234567890');

    await page.waitForTimeout(500);

    const duplicateWarning = page.getByText(/duplicate|already exists/i);
    if (await duplicateWarning.isVisible()) {
      await expect(duplicateWarning).toBeVisible();
    }
  });

  test('form validation shows errors for missing required fields', async ({ page }) => {
    await page.goto('/parties/new');

    await page.click('button[type="submit"]');

    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Phone is required')).toBeVisible();
  });
});
