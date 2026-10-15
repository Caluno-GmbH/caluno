import { expect, test } from '@playwright/test';
import { BASE_URL } from '../pages/AuthPage';
import { LoginPage } from '../pages/LoginPage';
import { ShiftsPage } from '../pages/shifts/ShiftsPage';

const EVENT_ASSISTANCE_SHIFT_ID = 'e2915169-290d-42b2-a2e2-6d9992bb8814';
const UNKNOWN_SHIFT_ID = '00000000-0000-0000-0000-000000000000';

// Event Assistance is open (ALL_MEMBERS) and pinned in the Playground seed.
// Invite-only coverage creates a fresh INVITED_MEMBERS shift as the e2e admin
// instead of looking up a seeded row by title (those rows do not pin a UUID).
const ADMIN_EMAIL = 'demo+e2e_admin@caluno.org';
const ADMIN_PASSWORD = 'abcd1234';

test.describe('public shift detail page', () => {
  test('renders shift title and org name', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/shifts/${EVENT_ASSISTANCE_SHIFT_ID}`);
    await expect(page.locator('h1')).toContainText('Event Assistance');
    await expect(page.getByRole('link', { name: 'Playground' })).toBeVisible();
  });

  test('shows event badge when shift is part of an event', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/shifts/${EVENT_ASSISTANCE_SHIFT_ID}`);
    await expect(
      page.getByRole('link', { name: /public test event/i }),
    ).toBeVisible();
  });

  test('returns 404 for unknown shift', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/shifts/${UNKNOWN_SHIFT_ID}`);
    await expect(
      page.getByRole('heading', {
        name: 'This assignment no longer exists',
      }),
    ).toBeVisible();
  });

  test('shows invite-only state for invite-only shift', async ({
    page,
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const login = new LoginPage(adminPage);
    await login.goto();
    await login.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminPage.waitForURL(/\/en\/?$/, { timeout: 15_000 });

    await adminPage.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await adminPage.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUId = new URL(adminPage.url()).pathname.split('/')[3];

    const shifts = new ShiftsPage(adminPage);
    await shifts.goto(orgUId);
    await shifts.openCreateForm();
    const shiftId = await shifts.createShift({
      name: `E2E Invite-Only Public Detail ${Date.now()}`,
      startTime: '20:00',
      endTime: '23:00',
      recurrence: 'Does not repeat',
      openShift: false,
    });
    expect(shiftId, 'created invite-only shift should have an id').not.toBe('');
    await adminContext.close();

    await page.goto(`${BASE_URL}/en/shifts/${shiftId}`);
    await expect(
      page.getByRole('button', { name: /invite only/i }),
    ).toBeVisible();
  });
});
