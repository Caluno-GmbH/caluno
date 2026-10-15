import { expect, test } from '@playwright/test';
import { BASE_URL } from '../pages/AuthPage';

// Depends on the e2e seed (apps/backend/src/database/fixtures.ts,
// `bun run db:fixtures:e2e`).
const PUBLIC_EVENT_ID = '579c7351-933b-4a32-9678-37aee42649d6';
const EVENT_ASSISTANCE_SHIFT_ID = 'b13bdd59-9965-49c2-84be-7c943c6d8a79';

test.describe('public event detail page', () => {
  test('renders event title and org name', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/events/${PUBLIC_EVENT_ID}`);
    await expect(page.locator('h1')).toContainText('Public Test Event');
    await expect(page.getByRole('link', { name: 'Testing' })).toBeVisible();
  });

  test('returns 404 for unknown event', async ({ page }) => {
    await page.goto(
      `${BASE_URL}/en/events/00000000-0000-0000-0000-000000000000`,
    );
    await expect(
      page.getByRole('heading', { name: 'This page could not be found.' }),
    ).toBeVisible();
  });

  test('redirects anonymous follow click to signup with invite context', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/events/${PUBLIC_EVENT_ID}`);
    await page.getByRole('button', { name: /step up to help/i }).click();
    await expect(page).toHaveURL(/\/en\/signup/);
    await expect(
      page.getByRole('heading', { name: /join testing/i }),
    ).toBeVisible();
    await expect(page.getByText(/powered by/i)).toBeVisible();
    // Brand mark is an image (alt "Caluno"), not plain text.
    await expect(page.getByRole('img', { name: 'Caluno' })).toBeVisible();
  });

  test('shows event badge on shift detail when part of event', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/shifts/${EVENT_ASSISTANCE_SHIFT_ID}`);
    await expect(page.getByRole('link', { name: /event/i })).toBeVisible();
  });
});
