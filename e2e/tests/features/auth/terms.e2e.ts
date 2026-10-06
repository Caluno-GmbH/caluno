import { execFileSync } from 'node:child_process';
import { expect, type Page, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../../../pages/AuthPage';
import { LoginPage } from '../../../pages/LoginPage';
import { SignupPage } from '../../../pages/SignupPage';
import { TEST_PASSWORD, uniqueEmail } from '../../../utils/test-data';

// Terms & conditions acceptance. Like the other auth suites this runs against
// the deployed app by default; the gate + accept cases additionally need a
// published terms version and a pending (no terms_version) user, so they run
// against a local stack where the suite seeds both itself.
//
// Local run:
//   E2E_BASE_URL=http://localhost:3000 E2E_API_URL=http://localhost:5001 \
//   bun playwright test tests/features/auth/terms.e2e.ts
//
// The suite publishes `1.0` (the committed placeholder documents under
// apps/backend/legal/) and resets the two fixture users to a pending state
// before the run, so it is repeatable and does not depend on prior DB state.

const TERMS_VERSION = '1.0';
const FIXTURE_PASSWORD = 'abcd1234';
const GATE_USER = 'testing+001@caluno.org';
const ACCEPT_USER = 'testing+002@caluno.org';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/clippy';

const IS_LOCAL = /(^|:\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);

const CURRENT_TERMS_PDF_URL = `${API_URL}/legal/terms/current/en`;

const signupHeaders = {
  Origin: BASE_URL,
  Referer: `${BASE_URL}/en/signup`,
};

// Published so `mustAccept` flips true for users with no/mismatched
// acceptance. Run in a Bun subprocess (Playwright workers are Node, so the
// suite cannot use Bun's SQL client in-process).
const SEED_SCRIPT = [
  "import { SQL } from 'bun';",
  'const sql = new SQL(process.env.E2E_DATABASE_URL);',
  "await sql.unsafe('insert into terms_versions (version, class) values ($1, $2) on conflict (version) do nothing', [process.env.SEED_TERMS_VERSION, 'MAJOR']);",
  "const emails = (process.env.SEED_PENDING_EMAILS ?? '').split(',').filter(Boolean);",
  'for (const email of emails) {',
  "  await sql.unsafe('update users set terms_version = null, terms_accepted_at = null where email = $1', [email]);",
  "  await sql.unsafe('delete from terms_acceptances where user_id in (select id from users where email = $1)', [email]);",
  '}',
  'await sql.end();',
].join('\n');

function seedTermsState() {
  execFileSync('bun', ['-e', SEED_SCRIPT], {
    env: {
      ...process.env,
      E2E_DATABASE_URL: DATABASE_URL,
      SEED_TERMS_VERSION: TERMS_VERSION,
      SEED_PENDING_EMAILS: `${GATE_USER},${ACCEPT_USER}`,
    },
    stdio: 'pipe',
  });
}

// Playwright loads every spec file before running any test, so seeding here (and
// not in a hook) makes the published version available to the whole local run —
// signup now requires a published terms version, and other suites sign up too.
if (IS_LOCAL) {
  seedTermsState();
}

async function loginPending(page: Page, email: string) {
  const login = new LoginPage(page);
  await login.goto();
  const response = await login.login(email, FIXTURE_PASSWORD);
  expect(response.ok()).toBe(true);
  await login.expectLoggedIn();
}

test.describe('Terms & conditions acceptance', () => {
  test.skip(
    !IS_LOCAL,
    'Terms e2e needs a published terms version and pending fixture users; run against the local stack.',
  );

  test.beforeAll(() => {
    seedTermsState();
  });

  test('terms link opens the current terms PDF in a new tab and keeps the checkbox unchecked', async ({
    page,
    request,
  }) => {
    const signup = new SignupPage(page);
    await signup.goto();

    await expect(signup.termsLink).toHaveAttribute(
      'href',
      CURRENT_TERMS_PDF_URL,
    );
    await expect(signup.termsLink).toHaveAttribute('target', '_blank');

    const pdf = await request.get(CURRENT_TERMS_PDF_URL);
    expect(pdf.ok()).toBe(true);
    expect(pdf.headers()['content-type'] ?? '').toMatch(/pdf/i);

    const popupPromise = page.waitForEvent('popup');
    await signup.termsLink.click();
    await popupPromise;
    await expect(signup.termsCheckbox).not.toBeChecked();
  });

  test('create-account stays disabled until both privacy and terms are checked', async ({
    page,
  }) => {
    const signup = new SignupPage(page);
    await signup.goto();

    await signup.fillForm({
      firstname: 'E2E',
      lastname: 'User',
      email: uniqueEmail(),
      password: TEST_PASSWORD,
    });

    await expect(signup.privacyCheckbox).not.toBeChecked();
    await expect(signup.termsCheckbox).not.toBeChecked();
    await expect(signup.submitButton).toBeDisabled();

    await signup.acceptPrivacyPolicy();
    await expect(signup.privacyCheckbox).toBeChecked();
    await expect(signup.submitButton).toBeDisabled();

    await signup.acceptTerms();
    await expect(signup.termsCheckbox).toBeChecked();
    await expect(signup.submitButton).toBeEnabled();
  });

  test('signup without terms acceptance is rejected and creates no user', async ({
    request,
  }) => {
    const email = uniqueEmail();

    const response = await request.post(`${API_URL}/api/auth/sign-up/email`, {
      headers: signupHeaders,
      data: {
        name: 'E2E User',
        firstname: 'E2E',
        lastname: 'User',
        email,
        password: TEST_PASSWORD,
        privacyPolicyAccepted: true,
      },
    });
    expect(response.status()).toBe(400);

    const signIn = await request.post(`${API_URL}/api/auth/sign-in/email`, {
      headers: signupHeaders,
      data: { email, password: TEST_PASSWORD },
    });
    expect(signIn.ok()).toBe(false);
  });

  test('a pending user is redirected to accept-terms when visiting the app root', async ({
    page,
  }) => {
    await loginPending(page, GATE_USER);

    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(/\/accept-terms\?next=%2F$/);
  });

  test('accept is gated on scrolling to the end, then restores the intended destination', async ({
    page,
  }) => {
    await loginPending(page, ACCEPT_USER);

    const pdfResponse = page.waitForResponse((response) =>
      response.url().includes(`/legal/terms/${TERMS_VERSION}/en`),
    );

    await page.goto(`${BASE_URL}/en/my-shifts`);
    await expect(page).toHaveURL(/\/accept-terms\?next=%2Fmy-shifts$/);
    await pdfResponse;

    const scroll = page.locator('.overflow-y-auto');
    await expect(scroll.locator('canvas').first()).toBeVisible();
    await expect
      .poll(() =>
        scroll.evaluate((el) => el.scrollHeight > el.clientHeight + 8),
      )
      .toBe(true);

    const acceptButton = page.getByRole('button', {
      name: 'Accept and continue',
    });
    await expect(acceptButton).toBeDisabled();

    await scroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await expect(acceptButton).toBeEnabled();
    await acceptButton.click();
    await expect(page).toHaveURL(/\/en\/my-shifts$/);
  });
});
