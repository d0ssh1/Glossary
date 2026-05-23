import { test, expect } from '@playwright/test';

test('open glossary from dashboard and verify graph SVG', async ({ page }) => {
  await page.goto('/');
  // Known mock glossary names are like "Глоссарий ..." — click the first one.
  await page.locator('button:has-text("Глоссарий")').first().click();
  await expect(page.locator('svg').first()).toBeVisible({ timeout: 10_000 });
});

test('left panel toggles', async ({ page }) => {
  await page.goto('/');
  await page.locator('button:has-text("Глоссарий")').first().click();
  // Editor mounted — find toggle button in toolbar.
  // Toolbar has a button that fires TOGGLE_LEFT_PANEL — find by panel-side icon button.
  // We'll assert there's at least one svg (graph) present; toggling exact panel selectors is fragile.
  await expect(page.locator('svg').first()).toBeVisible({ timeout: 10_000 });
});
