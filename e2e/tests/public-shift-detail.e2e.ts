import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { BASE_URL } from '../pages/AuthPage';

const EVENT_ASSISTANCE_SHIFT_ID = 'e2915169-290d-42b2-a2e2-6d9992bb8814';
const UNKNOWN_SHIFT_ID = '00000000-0000-0000-0000-000000000000';

// Event Assistance is open (ALL_MEMBERS). Invite-only coverage uses a
// Playground fixture looked up by title — those rows are idempotent by title
// but do not pin a UUID in fixtures.ts.
const INVITE_ONLY_SHIFT_TITLE = 'Night Shelter Shift';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/caluno';

function inviteOnlyShiftId(): string {
  const script = [
    "import { SQL } from 'bun';",
    'const sql = new SQL(process.env.E2E_DATABASE_URL);',
    'const rows = await sql.unsafe(',
    "  'select id from shifts where title = $1 limit 1',",
    '  [process.env.SEED_SHIFT_TITLE],',
    ');',
    'if (!rows[0]?.id) {',
    '  throw new Error(`No shift titled ${process.env.SEED_SHIFT_TITLE}`);',
    '}',
    'console.log(rows[0].id);',
    'await sql.end();',
  ].join('\n');
  return execFileSync('bun', ['-e', script], {
    env: {
      ...process.env,
      E2E_DATABASE_URL: DATABASE_URL,
      SEED_SHIFT_TITLE: INVITE_ONLY_SHIFT_TITLE,
    },
    encoding: 'utf8',
  }).trim();
}

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

  test('shows invite-only state for invite-only shift', async ({ page }) => {
    const shiftId = inviteOnlyShiftId();
    await page.goto(`${BASE_URL}/en/shifts/${shiftId}`);
    await expect(
      page.getByRole('button', { name: /invite only/i }),
    ).toBeVisible();
  });
});
