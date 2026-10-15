import { expect, test } from '@playwright/test';
import { BASE_URL } from '../pages/AuthPage';
import { LoginPage } from '../pages/LoginPage';

// Depends on the e2e seed (apps/backend/src/database/fixtures.ts, `bun run
// db:fixtures:e2e`). demo+testing_admin@caluno.org is a member of the seeded
// "Testing" org.
const ADMIN_EMAIL = 'demo+testing_admin@caluno.org';
const ADMIN_PASSWORD = 'abcd1234';

const ORG_DASHBOARD = /\/admin\/[0-9a-f-]{36}$/;

test('visiting /admin without a last-visited-org cookie goes to the first accessible org, not "create organization"', async ({
  page,
}) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  // Not `login.expectLoggedIn()` — that also asserts a "Home" heading which
  // doesn't exist on the real volunteer home page, just the redirect off /login.
  await page.waitForURL(/\/en\/?$/, { timeout: 15000 });

  // A fresh login has no `caluno.last_org_slug` cookie yet — this is exactly
  // the reported bug's precondition, so no need to clear cookies manually.
  await page.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });

  await expect(page).toHaveURL(ORG_DASHBOARD);
  await expect(page).not.toHaveURL(/\/admin\/create-organization/);
  await expect(page.getByRole('link', { name: 'To do' })).toBeVisible();
});
