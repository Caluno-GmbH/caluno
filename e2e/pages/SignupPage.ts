import { expect, type Response } from '@playwright/test';
import { AuthPage } from './AuthPage';

export class SignupPage extends AuthPage {
  get firstnameInput() {
    return this.page.getByLabel('First name');
  }

  get lastnameInput() {
    return this.page.getByLabel('Last name');
  }

  get submitButton() {
    return this.page.getByRole('button', { name: 'Create account' });
  }

  get loginLink() {
    return this.page.getByRole('link', { name: 'Sign in' });
  }

  get privacyCheckbox() {
    return this.page.getByRole('checkbox', { name: /privacy policy/i });
  }

  get privacyLink() {
    return this.page.getByRole('link', { name: 'Privacy Policy' });
  }

  get termsCheckbox() {
    return this.page.getByRole('checkbox', { name: /terms/i });
  }

  get termsLink() {
    return this.page.getByRole('link', { name: /terms and conditions/i });
  }

  async goto() {
    await this.page.goto(this.url('/signup'), { waitUntil: 'load' });
  }

  async acceptPrivacyPolicy() {
    await this.privacyCheckbox.check();
  }

  async acceptTerms() {
    await this.termsCheckbox.check();
  }

  async signup(
    firstname: string,
    lastname: string,
    email: string,
    password: string,
  ): Promise<Response> {
    await this.firstnameInput.fill(firstname);
    await this.lastnameInput.fill(lastname);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.acceptPrivacyPolicy();
    await this.acceptTerms();
    const [res] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/api/auth/sign-up/email'),
        { timeout: 15000 },
      ),
      this.submitButton.click(),
    ]);
    return res;
  }

  // Signup routes to the email-verification page.
  async expectVerificationPrompt() {
    await expect(this.page).toHaveURL(/\/en\/verify-email/);
    await expect(
      this.page.getByRole('heading', { name: 'Verify your email' }),
    ).toBeVisible();
  }

  // Server-side errors (invalid email, rate limit, ...) surface as a toast.
  get errorToast() {
    return this.page.locator('[data-sonner-toast]');
  }

  async submit() {
    await this.submitButton.click();
  }

  // Fills only the provided fields; leaves the rest untouched.
  async fillForm(values: {
    firstname?: string;
    lastname?: string;
    email?: string;
    password?: string;
    privacyAccepted?: boolean;
    termsAccepted?: boolean;
  }) {
    if (values.firstname !== undefined) {
      await this.firstnameInput.fill(values.firstname);
    }
    if (values.lastname !== undefined) {
      await this.lastnameInput.fill(values.lastname);
    }
    if (values.email !== undefined) await this.emailInput.fill(values.email);
    if (values.password !== undefined) {
      await this.passwordInput.fill(values.password);
    }
    if (values.privacyAccepted) await this.acceptPrivacyPolicy();
    if (values.termsAccepted) await this.acceptTerms();
  }

  private fieldLocator(field: 'firstname' | 'lastname' | 'email' | 'password') {
    if (field === 'firstname') return this.firstnameInput;
    if (field === 'lastname') return this.lastnameInput;
    if (field === 'email') return this.emailInput;
    return this.passwordInput;
  }

  // Native HTML5 constraint-validation state for a field.
  fieldValidity(field: 'firstname' | 'lastname' | 'email' | 'password') {
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
