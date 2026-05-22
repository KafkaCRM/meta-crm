import { test, expect } from '@playwright/test';

test.describe('Realtime Updates', () => {
  test('case stage change in one tab updates kanban in another tab', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await page1.goto('/login');
      await page1.fill('#email', process.env['E2E_USER_EMAIL'] ?? 'admin@test.com');
      await page1.fill('#password', process.env['E2E_USER_PASSWORD'] ?? 'password123');
      await page1.click('button[type="submit"]');
      await expect(page1).toHaveURL('/');

      await page2.goto('/login');
      await page2.fill('#email', process.env['E2E_USER_2_EMAIL'] ?? 'manager@test.com');
      await page2.fill('#password', process.env['E2E_USER_2_PASSWORD'] ?? 'password123');
      await page2.click('button[type="submit"]');
      await expect(page2).toHaveURL('/');

      await page1.goto('/cases');
      await page2.goto('/cases');

      await expect(page1.locator('[data-kanban-card]')).toBeVisible();
      await expect(page2.locator('[data-kanban-card]')).toBeVisible();

      const firstCard = page1.locator('[data-kanban-card]').first();
      const targetColumn = page1.locator('[data-kanban-column]').nth(1);

      if (await firstCard.isVisible() && await targetColumn.isVisible()) {
        const cardBox = await firstCard.boundingBox();
        const columnBox = await targetColumn.boundingBox();

        if (cardBox && columnBox) {
          await page1.mouse.move(
            cardBox.x + cardBox.width / 2,
            cardBox.y + cardBox.height / 2,
          );
          await page1.mouse.down();
          await page1.mouse.move(
            columnBox.x + columnBox.width / 2,
            columnBox.y + columnBox.height / 2,
            { steps: 10 },
          );
          await page1.mouse.up();

          await page2.waitForTimeout(2000);

          await expect(page2.locator('[data-kanban-card]')).toBeVisible();
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
