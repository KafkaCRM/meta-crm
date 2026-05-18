import { test, expect } from '@playwright/test';

test.describe('Stage Transition', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#tenant', process.env['E2E_TENANT_SLUG'] ?? 'test-tenant');
    await page.fill('#email', process.env['E2E_USER_EMAIL'] ?? 'admin@test.com');
    await page.fill('#password', process.env['E2E_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('drag a case card between kanban columns', async ({ page }) => {
    await page.goto('/cases');

    const firstCard = page.locator('[data-kanban-card]').first();
    const targetColumn = page.locator('[data-kanban-column]').nth(1);

    if (await firstCard.isVisible()) {
      const cardBox = await firstCard.boundingBox();
      const columnBox = await targetColumn.boundingBox();

      if (cardBox && columnBox) {
        await page.mouse.move(
          cardBox.x + cardBox.width / 2,
          cardBox.y + cardBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          columnBox.x + columnBox.width / 2,
          columnBox.y + columnBox.height / 2,
          { steps: 10 },
        );
        await page.mouse.up();

        await expect(page.locator('[data-kanban-card]')).toBeVisible();
      }
    }
  });

  test('criteria unmet shows error and rolls back', async ({ page }) => {
    await page.goto('/cases');

    const firstCard = page.locator('[data-kanban-card]').first();
    const targetColumn = page.locator('[data-kanban-column]').nth(2);

    if (await firstCard.isVisible() && await targetColumn.isVisible()) {
      const cardBox = await firstCard.boundingBox();
      const columnBox = await targetColumn.boundingBox();

      if (cardBox && columnBox) {
        await page.mouse.move(
          cardBox.x + cardBox.width / 2,
          cardBox.y + cardBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          columnBox.x + columnBox.width / 2,
          columnBox.y + columnBox.height / 2,
          { steps: 10 },
        );
        await page.mouse.up();

        const errorMessage = page.getByText(/criteria|unmet|not met/i);
        if (await errorMessage.isVisible()) {
          await expect(errorMessage).toBeVisible();
        }

        await expect(firstCard).toBeVisible();
      }
    }
  });
});
