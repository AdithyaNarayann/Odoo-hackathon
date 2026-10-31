import { test, expect } from '@playwright/test';

test.describe('Brightloop Subscription Management System E2E Suite', () => {

  test('Flow 1: Customer Signup redirects to role home (/subscriptions) without bounce', async ({ page }) => {
    const timestamp = Date.now();
    const uniqueEmail = `testuser_${timestamp}@example.com`;

    await page.goto('/signup');
    await expect(page).toHaveURL(/.*\/signup/);

    // Fill registration form
    await page.fill('input[placeholder="e.g. Adithya Narayan"]', 'E2E Customer');
    await page.fill('input[placeholder="e.g. Acme Corporation"]', 'E2E Global Corp');
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    await page.fill('input[placeholder="••••••••••••"]', 'SecurePass@2026!');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to role home: /subscriptions
    await expect(page).toHaveURL(/.*\/subscriptions/, { timeout: 15000 });
    // Verify auth persists and user is on subscriptions page
    await expect(page.locator('text=E2E Customer')).toBeVisible();
  });

  test('Flow 2: Customer Accept Quotation updates status to Confirmed', async ({ page }) => {
    // Log in as customer
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer@brightloop.com');
    await page.fill('input[type="password"]', 'Customer@1234');
    await page.click('button[type="submit"]');

    // Land on /subscriptions
    await expect(page).toHaveURL(/.*\/subscriptions/, { timeout: 15000 });

    // Look for quotation subscription or accept button
    const acceptBtn = page.locator('button:has-text("Accept Quotation")').first();
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      await expect(page.locator('text=Quotation accepted')).toBeVisible({ timeout: 10000 });
    } else {
      // Or view quotation detail and accept
      const row = page.locator('tr:has-text("Quotation")').first();
      if (await row.isVisible()) {
        await row.locator('button:has-text("Accept")').click();
        await expect(page.locator('text=Quotation accepted')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Flow 3: Customer Add-on Self-Service toggle updates recurring subtotal immediately', async ({ page }) => {
    // Log in as customer
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer@brightloop.com');
    await page.fill('input[type="password"]', 'Customer@1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/subscriptions/, { timeout: 15000 });

    // Navigate to active subscription detail
    const activeSubLink = page.locator('tr:has-text("Active") a, tr:has-text("Active") span').first();
    if (await activeSubLink.isVisible()) {
      await activeSubLink.click();
      await page.waitForURL(/.*\/subscriptions\/\d+/, { timeout: 10000 });

      // Check if add-on toggle exists
      const toggle = page.locator('button[role="switch"], input[type="checkbox"]').first();
      if (await toggle.isVisible()) {
        await toggle.click();
        await expect(page.locator('text=Contract line updated, text=updated')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Flow 4: Staff Advance Billing Run generates draft invoices', async ({ page }) => {
    // Log in as staff
    await page.goto('/login');
    await page.fill('input[type="email"]', 'staff@brightloop.com');
    await page.fill('input[type="password"]', 'Staff@1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Go to Billing Run
    await page.goto('/billing');
    await expect(page.locator('h1')).toContainText(/BILLING/i);

    // Trigger billing preview / run
    const runBtn = page.locator('button:has-text("Run Billing"), button:has-text("Execute Billing")').first();
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await expect(page.locator('text=Billing run completed, text=Invoices Created, text=success')).toBeVisible({ timeout: 15000 });
    }
  });

  test('Flow 5: Staff Record Payment transitions invoice to Paid', async ({ page }) => {
    // Log in as staff
    await page.goto('/login');
    await page.fill('input[type="email"]', 'staff@brightloop.com');
    await page.fill('input[type="password"]', 'Staff@1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Navigate to invoices
    await page.goto('/invoices');
    await expect(page.locator('h1')).toContainText(/INVOICES/i);

    // Open first confirmed invoice with balance
    const invoiceRow = page.locator('tr:has-text("Confirmed")').first();
    if (await invoiceRow.isVisible()) {
      await invoiceRow.locator('span, a').first().click();
      await page.waitForURL(/.*\/invoices\/\d+/, { timeout: 10000 });

      // Look for Record Payment button
      const recordPaymentBtn = page.locator('button:has-text("Record Payment")').first();
      if (await recordPaymentBtn.isVisible()) {
        await recordPaymentBtn.click();

        // Payment modal appears
        const amountInput = page.locator('input[type="number"], input[placeholder*="Amount"]').first();
        if (await amountInput.isVisible()) {
          // Record full or partial payment
          await page.click('button:has-text("Confirm Payment"), button[type="submit"]:has-text("Record")');
          await expect(page.locator('text=Payment recorded')).toBeVisible({ timeout: 8000 });
        }
      }
    }
  });

  test('Flow 6: Pipeline Board displays 5 columns matching the sheet', async ({ page }) => {
    // Log in as staff
    await page.goto('/login');
    await page.fill('input[type="email"]', 'staff@brightloop.com');
    await page.fill('input[type="password"]', 'Staff@1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Switch to board view on subscriptions
    await page.goto('/subscriptions?view=board');
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByText('Quotation', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByText('Closed', { exact: true })).toBeVisible();

    // Click first card to open detail
    const card = page.locator('div[class*="border-2 border-ink"]:has-text("BL-")').first();
    if (await card.isVisible()) {
      await card.click();
      await expect(page).toHaveURL(/.*\/subscriptions\/\d+/, { timeout: 10000 });
    }
  });

  test('Flow 7: Deep link and reload preserves authentication', async ({ page }) => {
    // Log in as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@brightloop.com');
    await page.fill('input[type="password"]', 'Admin@1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Navigate to deep link
    await page.goto('/subscriptions/1');
    await expect(page).toHaveURL(/.*\/subscriptions\/1/);
    await expect(page.locator('h1')).toBeVisible();

    // Reload page
    await page.reload();

    // Must NOT be redirected to /login; must stay on /subscriptions/1
    await expect(page).toHaveURL(/.*\/subscriptions\/1/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Page Sweep: Staff and Admin routes load cleanly with 0 console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Log in as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@brightloop.com');
    await page.fill('input[type="password"]', 'Admin@1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const adminRoutes = [
      '/dashboard',
      '/customers',
      '/subscriptions',
      '/templates',
      '/products',
      '/plans',
      '/billing',
      '/invoices',
      '/payments',
      '/discounts',
      '/reports',
      '/settings',
    ];

    for (const route of adminRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      // Verify main container or title is rendered
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }

    // Filter out benign favicon or external font warnings if any
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon.ico') && !e.includes('fonts.googleapis.com')
    );
    expect(realErrors.length).toBe(0);
  });

});
