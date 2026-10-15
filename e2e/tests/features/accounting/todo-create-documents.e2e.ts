import { mkdirSync } from 'node:fs';
import { type Browser, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../../../pages/AuthPage';
import { AccountingTemplatesPage } from '../../../pages/accounting/AccountingTemplatesPage';
import { LoginPage } from '../../../pages/LoginPage';

/**
 * AC1–2 for todo-create-contract-invoice: after a paid closed time entry
 * auto-queues a DRAFT agreement, To do shows Create agreements + Create
 * timesheets cards for that volunteer.
 *
 * Uses Playground e2e fixtures (`demo+e2e_*`). Templates are configured in
 * beforeAll like documents-flow.e2e.ts.
 */
const ADMIN_EMAIL = 'demo+e2e_admin@caluno.org';
const VOLUNTEER_EMAIL = 'demo+e2e_member03@caluno.org';
const VOLUNTEER_NAME = 'Playground Member Three';
const PASSWORD = 'abcd1234';

const adminAuthFile = '.auth/todo-create-admin.json';

async function saveAuthState(
  browser: Browser,
  email: string,
  authFile: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = new LoginPage(page);
  await login.goto();
  await login.login(email, PASSWORD);
  await page.waitForURL(/\/en\/?$/, { timeout: 15_000 });
  await context.storageState({ path: authFile });
  await context.close();
}

async function graphql<T>(
  page: import('@playwright/test').Page,
  orgUnitId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await page.request.post(`${API_URL}/graphql`, {
    headers: { 'x-organization-unit-id': orgUnitId },
    data: { query, variables },
  });
  const body = (await response.json()) as {
    data?: T;
    errors?: unknown[];
  };
  if (!response.ok() || body.errors) {
    throw new Error(
      `GraphQL failed: ${JSON.stringify(body.errors ?? response.status())}`,
    );
  }
  return body.data as T;
}

test.describe('To do — create agreement / timesheet tasks', () => {
  test.beforeAll(async ({ browser }) => {
    mkdirSync('.auth', { recursive: true });
    await saveAuthState(browser, ADMIN_EMAIL, adminAuthFile);

    const adminContext = await browser.newContext({
      storageState: adminAuthFile,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await adminPage.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUnitId = new URL(adminPage.url()).pathname.split('/')[3];
    const templates = new AccountingTemplatesPage(adminPage);
    await templates.goto(orgUnitId);
    await templates.configureTemplate('ehrenamt', 'contract');
    await templates.configureTemplate('ehrenamt', 'invoice');
    await adminContext.close();
  });

  test('closed paid hours show Create agreements (draft) and Create timesheets on To do', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext({
      storageState: adminAuthFile,
    });
    const page = await adminContext.newPage();
    await page.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await page.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUnitId = new URL(page.url()).pathname.split('/')[3];
    if (!orgUnitId) throw new Error('Missing org unit id from admin URL');

    const memberships = await graphql<{
      memberships: {
        user: { id: string; email: string };
      }[];
    }>(
      page,
      orgUnitId,
      `query {
        memberships {
          user { id email }
        }
      }`,
    );
    const volunteer = memberships.memberships.find(
      (row) => row.user.email === VOLUNTEER_EMAIL,
    )?.user;
    if (!volunteer) {
      throw new Error(`Volunteer ${VOLUNTEER_EMAIL} not in unit memberships`);
    }

    const types = await graphql<{
      reimbursementTypes: { id: string; key: string }[];
    }>(page, orgUnitId, `query { reimbursementTypes { id key } }`);
    const ehrenamt = types.reimbursementTypes.find(
      (type) => type.key === 'EHRENAMT',
    );
    if (!ehrenamt) throw new Error('EHRENAMT reimbursement type missing');

    // Unique month so re-runs do not collide with prior claimed hours.
    const stamp = Date.now();
    const startedAt = new Date(stamp - 2 * 60 * 60 * 1000).toISOString();
    const endedAt = new Date(stamp - 60 * 60 * 1000).toISOString();

    await graphql(
      page,
      orgUnitId,
      `mutation AddPaidHours($input: AddTimeEntryInput!) {
        addTimeEntry(input: $input) { id }
      }`,
      {
        input: {
          volunteerId: volunteer.id,
          startedAt,
          endedAt,
          reimbursementTypeId: ehrenamt.id,
          notes: `e2e todo-create ${stamp}`,
        },
      },
    );

    await page.goto(`${BASE_URL}/en/admin/${orgUnitId}`, {
      waitUntil: 'load',
    });

    const agreements = page.getByRole('heading', {
      name: /Create agreements/i,
    });
    const timesheets = page.getByRole('heading', {
      name: /Create timesheets/i,
    });
    await expect(agreements).toBeVisible({ timeout: 20_000 });
    await expect(timesheets).toBeVisible({ timeout: 20_000 });

    const agreementsSection = agreements.locator('xpath=ancestor::section[1]');
    const timesheetsSection = timesheets.locator('xpath=ancestor::section[1]');
    await expect(agreementsSection).toContainText(VOLUNTEER_NAME);
    await expect(timesheetsSection).toContainText(VOLUNTEER_NAME);

    await adminContext.close();
  });
});
