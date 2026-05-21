import { test, expect } from '@playwright/test';

test.describe('Capabilities Integration & Dashboard Widgets', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Log in
    await page.goto('/login');
    await page.fill('#tenant', process.env['E2E_TENANT_SLUG'] ?? 'test-tenant');
    await page.fill('#email', process.env['E2E_USER_EMAIL'] ?? 'admin@test.com');
    await page.fill('#password', process.env['E2E_USER_PASSWORD'] ?? 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('toggle appointments capability, check sidebar link and dashboard widget', async ({ page }) => {
    // Navigate to Settings -> Capabilities
    await page.goto('/settings/capabilities');
    await expect(page.getByText('Capabilities', { exact: true })).toBeVisible();

    // Locate the row for "Appointments & Scheduling"
    const apptRow = page.locator('div', { has: page.locator('p', { hasText: 'Appointments & Scheduling' }) }).last();
    const apptToggle = apptRow.locator('button');
    const isApptEnabledInitially = await apptToggle.getAttribute('class').then(c => c?.includes('bg-primary'));

    // Toggle it (enable if disabled, disable if enabled)
    await apptToggle.click();

    // Verify success toast
    await expect(page.locator('text=Capability updated')).toBeVisible();

    // Verify updated toggle state
    const isApptEnabledAfter = await apptToggle.getAttribute('class').then(c => c?.includes('bg-primary'));
    expect(isApptEnabledAfter).not.toBe(isApptEnabledInitially);

    // Check sidebar navigation links dynamically updated
    if (isApptEnabledAfter) {
      await expect(page.getByRole('link', { name: 'Appointments' })).toBeVisible();
      // Go to dashboard and verify the Appointments widget shows up
      await page.goto('/');
      await expect(page.getByText("Today's Appointments")).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Appointments' })).not.toBeVisible();
      // Go to dashboard and verify the Appointments widget is hidden
      await page.goto('/');
      await expect(page.getByText("Today's Appointments")).not.toBeVisible();
    }

    // Toggle it back to restore clean state
    await page.goto('/settings/capabilities');
    await apptToggle.click();
    await expect(page.locator('text=Capability updated')).toBeVisible();
  });

  test('toggle billing capability, check sidebar link and dashboard widget', async ({ page }) => {
    // Navigate to Settings -> Capabilities
    await page.goto('/settings/capabilities');

    // Locate the row for "Invoicing & Billing"
    const billingRow = page.locator('div', { has: page.locator('p', { hasText: 'Invoicing & Billing' }) }).last();
    const billingToggle = billingRow.locator('button');
    const isBillingEnabledInitially = await billingToggle.getAttribute('class').then(c => c?.includes('bg-primary'));

    // Toggle it
    await billingToggle.click();
    await expect(page.locator('text=Capability updated')).toBeVisible();

    const isBillingEnabledAfter = await billingToggle.getAttribute('class').then(c => c?.includes('bg-primary'));
    expect(isBillingEnabledAfter).not.toBe(isBillingEnabledInitially);

    // Check sidebar and dashboard widget
    if (isBillingEnabledAfter) {
      await expect(page.getByRole('link', { name: 'Invoices' })).toBeVisible();
      await page.goto('/');
      await expect(page.getByText('Billing & Invoicing')).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Invoices' })).not.toBeVisible();
      await page.goto('/');
      await expect(page.getByText('Billing & Invoicing')).not.toBeVisible();
    }

    // Toggle back
    await page.goto('/settings/capabilities');
    await billingToggle.click();
    await expect(page.locator('text=Capability updated')).toBeVisible();
  });

  test('toggle property listing capability, check sidebar link and dashboard widget', async ({ page }) => {
    // Navigate to Settings -> Capabilities
    await page.goto('/settings/capabilities');

    // Locate the row for "Property Listings"
    const propRow = page.locator('div', { has: page.locator('p', { hasText: 'Property Listings' }) }).last();
    const propToggle = propRow.locator('button');
    const isPropEnabledInitially = await propToggle.getAttribute('class').then(c => c?.includes('bg-primary'));

    // Toggle it
    await propToggle.click();
    await expect(page.locator('text=Capability updated')).toBeVisible();

    const isPropEnabledAfter = await propToggle.getAttribute('class').then(c => c?.includes('bg-primary'));
    expect(isPropEnabledAfter).not.toBe(isPropEnabledInitially);

    // Check sidebar and dashboard widget
    if (isPropEnabledAfter) {
      await expect(page.getByRole('link', { name: 'Properties' })).toBeVisible();
      await page.goto('/');
      await expect(page.getByText('Property Listings')).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Properties' })).not.toBeVisible();
      await page.goto('/');
      await expect(page.getByText('Property Listings')).not.toBeVisible();
    }

    // Toggle back
    await page.goto('/settings/capabilities');
    await propToggle.click();
    await expect(page.locator('text=Capability updated')).toBeVisible();
  });
});
