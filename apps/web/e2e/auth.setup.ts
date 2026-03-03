import { test as setup, expect } from '@playwright/test';

// Clerk test mode: use Clerk's testing tokens for deterministic auth
// https://clerk.com/docs/testing/overview
setup('authenticate as manager', async ({ page }) => {
  await page.goto('/sign-in');

  // Use Clerk test credentials (seeded in CI)
  await page.fill('[name="identifier"]', process.env.TEST_USER_EMAIL!);
  await page.click('button:has-text("Continue")');
  await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button:has-text("Continue")');

  // Wait for workspace redirect
  await page.waitForURL(/\/w\//);
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
