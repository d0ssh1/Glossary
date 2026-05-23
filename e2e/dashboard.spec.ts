import { test, expect } from '@playwright/test';

test('dashboard renders course list header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Текущие курсы')).toBeVisible();
});

test('add-course button opens modal', async ({ page }) => {
  await page.goto('/');
  // top-level "добавить" button at the courses header
  await page.getByRole('button', { name: /^добавить$/ }).first().click();
  // modal should open — look for any input field that appeared
  await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 });
});
