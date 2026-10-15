import type { Response } from '@playwright/test';
import { AcceptTermsPage } from './AcceptTermsPage';
import { AuthPage } from './AuthPage';

export class LoginPage extends AuthPage {
  get submitButton() {
    return this.page.getByRole('button', { name: 'Sign in' });
  }

  get signupLink() {
    return this.page.getByRole('link', { name: 'Sign up' });
  }

  get forgotPasswordLink() {
    return this.page.getByRole('link', { name: 'Forgot password?' });
  }

  async goto() {
    await this.page.goto(this.url('/login'), { waitUntil: 'load' });
  }

  /**
   * Sign in. By default, if the post-login redirect lands on /accept-terms
   * (pending major terms), scrolls and accepts so callers are not stuck.
   * Pass `{ acceptPendingTerms: false }` when the test needs the gate itself
   * (see terms.e2e.ts).
   */
  async login(
    email: string,
    password: string,
    options: { acceptPendingTerms?: boolean } = {},
  ): Promise<Response> {
    const { acceptPendingTerms = true } = options;
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    const [res] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/api/auth/sign-in/email'),
        { timeout: 15000 },
      ),
      this.submitButton.click(),
    ]);
    if (acceptPendingTerms && res.ok()) {
      await this.acceptPendingTermsIfShown();
    }
    return res;
  }

  // Post-login default redirect is `/`, which the volunteering layout may
  // bounce to /accept-terms for users who must accept a new major version.
  private async acceptPendingTermsIfShown() {
    await this.page.waitForURL(
      (url) =>
        !url.pathname.includes('/login') &&
        !url.pathname.includes('/verify-email'),
      { timeout: 30_000, waitUntil: 'commit' },
    );

    if (AcceptTermsPage.isOnPage(this.page)) {
      await new AcceptTermsPage(this.page).accept();
      return;
    }

    // Soft-nav can commit `/` before the terms redirect. Race the bounce
    // against the volunteer shell (nav only mounts after the gate passes).
    const termsLanded = this.page
      .waitForURL(/\/accept-terms/, { timeout: 10_000, waitUntil: 'commit' })
      .then(() => 'terms' as const);
    const appShell = this.page
      .getByRole('navigation')
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => 'app' as const);
    const winner = await Promise.race([termsLanded, appShell]).catch(
      () => 'app' as const,
    );
    // Losing waiter may still reject after the race settles — swallow it.
    void termsLanded.catch(() => {});
    void appShell.catch(() => {});

    if (winner === 'terms') {
      await new AcceptTermsPage(this.page).accept();
    }
  }

  async expectLoggedIn() {
    // Logged in = navigated away from login (commit, so we don't wait on the
    // destination render). /accept-terms counts — the user is authenticated;
    // login({ acceptPendingTerms: true }) clears that gate when desired.
    await this.page.waitForURL(
      (url) =>
        !url.pathname.includes('/login') &&
        !url.pathname.includes('/verify-email'),
      { timeout: 30_000, waitUntil: 'commit' },
    );
  }

  // Server-side errors (bad credentials, rate limit, ...) surface as a toast.
  get errorToast() {
    return this.page.locator('[data-sonner-toast]');
  }

  async submit() {
    await this.submitButton.click();
  }

  // Fills only the provided fields; leaves the rest untouched.
  async fillForm(values: { email?: string; password?: string }) {
    if (values.email !== undefined) await this.emailInput.fill(values.email);
    if (values.password !== undefined) {
      await this.passwordInput.fill(values.password);
    }
  }

  private fieldLocator(field: 'email' | 'password') {
    return field === 'email' ? this.emailInput : this.passwordInput;
  }

  // Native HTML5 constraint-validation state for a field.
  fieldValidity(field: 'email' | 'password') {
    return this.fieldLocator(field).evaluate((el) => {
      const input = el as HTMLInputElement;
      return {
        valid: input.validity.valid,
        valueMissing: input.validity.valueMissing,
        typeMismatch: input.validity.typeMismatch,
        tooShort: input.validity.tooShort,
      };
    });
  }
}
