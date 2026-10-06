import { expect, test } from '@playwright/test';
import { SignupPage } from '../../../pages/SignupPage';

/**
 * Signup validation suite — strictly frontend-only.
 *
 * The signup form validates via native HTML5 constraints (required,
 * type=email, password minLength=6) plus a privacy-policy checkbox that
 * disables submit until checked. Tests that click submit therefore accept
 * the privacy policy first so native validation can run.
 *
 * No account is ever created here: native validation blocks submission, so no
 * signup request is sent — and every test asserts exactly that (via a passive
 * request listener, not interception). Successful signup belongs to the smoke
 * suite only. Privacy-policy behaviour is in privacy-policy.e2e.ts.
 */

// Valid filler values for the fields NOT under test (never submitted).
const VALID_FIRSTNAME = 'E2E';
const VALID_LASTNAME = 'User';
const VALID_EMAIL = 'user@example.com';
const VALID_PASSWORD = 'Test1234!aB';

test.describe('Signup validation', () => {
  let signup: SignupPage;
  let signupRequested: boolean;

  test.beforeEach(async ({ page }) => {
    signupRequested = false;
    // Passive observation only (no interception): flag a signup request if one
    // is ever sent, so afterEach can prove the form was never submitted.
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/sign-up/')) signupRequested = true;
    });

    signup = new SignupPage(page);
    await signup.goto();
  });

  test.afterEach(() => {
    expect(
      signupRequested,
      'validation tests must not send a signup request',
    ).toBe(false);
  });

  test.describe('required fields', () => {
    test('firstname is required', async ({ page }) => {
      await signup.fillForm({
        lastname: VALID_LASTNAME,
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        privacyAccepted: true,
        termsAccepted: true,
      });
      await signup.submit();

      expect(await signup.fieldValidity('firstname')).toMatchObject({
        valid: false,
        valueMissing: true,
      });
      await expect(page).toHaveURL(/\/signup/);
    });

    test('lastname is required', async ({ page }) => {
      await signup.fillForm({
        firstname: VALID_FIRSTNAME,
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        privacyAccepted: true,
        termsAccepted: true,
      });
      await signup.submit();

      expect(await signup.fieldValidity('lastname')).toMatchObject({
        valid: false,
        valueMissing: true,
      });
      await expect(page).toHaveURL(/\/signup/);
    });

    test('email is required', async ({ page }) => {
      await signup.fillForm({
        firstname: VALID_FIRSTNAME,
        lastname: VALID_LASTNAME,
        password: VALID_PASSWORD,
        privacyAccepted: true,
        termsAccepted: true,
      });
      await signup.submit();

      expect(await signup.fieldValidity('email')).toMatchObject({
        valid: false,
        valueMissing: true,
      });
      await expect(page).toHaveURL(/\/signup/);
    });

    test('password is required', async ({ page }) => {
      await signup.fillForm({
        firstname: VALID_FIRSTNAME,
        lastname: VALID_LASTNAME,
        email: VALID_EMAIL,
        privacyAccepted: true,
        termsAccepted: true,
      });
      await signup.submit();

      expect(await signup.fieldValidity('password')).toMatchObject({
        valid: false,
        valueMissing: true,
      });
      await expect(page).toHaveURL(/\/signup/);
    });
  });

  test.describe('email format', () => {
    // Confirmed rejected by the browser's type=email constraint.
    for (const email of ['notanemail', 'test@', 'test@a.']) {
      test(`rejects malformed email "${email}"`, async ({ page }) => {
        await signup.fillForm({
          firstname: VALID_FIRSTNAME,
          lastname: VALID_LASTNAME,
          email,
          password: VALID_PASSWORD,
          privacyAccepted: true,
          termsAccepted: true,
        });
        await signup.submit();

        expect(await signup.fieldValidity('email')).toMatchObject({
          valid: false,
          typeMismatch: true,
        });
        await expect(page).toHaveURL(/\/signup/);
      });
    }

    test('trims surrounding whitespace (type=email)', async () => {
      await signup.fillForm({ email: '  user@example.com  ' });
      // type=email strips leading/trailing spaces, so the value stays valid.
      expect(await signup.fieldValidity('email')).toMatchObject({
        valid: true,
      });
    });
  });

  test.describe('password length', () => {
    for (const password of ['1', '12345']) {
      test(`rejects password shorter than 6 ("${password}")`, async ({
        page,
      }) => {
        await signup.fillForm({
          firstname: VALID_FIRSTNAME,
          lastname: VALID_LASTNAME,
          email: VALID_EMAIL,
          password,
          privacyAccepted: true,
          termsAccepted: true,
        });
        await signup.submit();

        expect(await signup.fieldValidity('password')).toMatchObject({
          valid: false,
        });
        await expect(page).toHaveURL(/\/signup/);
      });
    }
  });

  test.describe('whitespace handling', () => {
    test('whitespace-only firstname is not blocked client-side (no trim on text field)', async () => {
      await signup.fillForm({ firstname: '   ' });
      // Documents current behaviour: native `required` is satisfied by spaces.
      expect(await signup.fieldValidity('firstname')).toMatchObject({
        valid: true,
      });
    });
  });
});
