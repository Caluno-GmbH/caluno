import type { Page } from '@playwright/test';
import { IS_LOCAL } from '../pages/AuthPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { Mailbox } from './mailbox';
import { TEST_PASSWORD } from './test-data';

export interface TestAccount {
  email: string;
  password: string;
}

// Signup -> (verify email via Mailpit on staging) -> login.
// Local stacks skip verification (NODE_ENV !== production). Leaves `page` authenticated.
export async function signUpVerifyAndLogin(page: Page): Promise<TestAccount> {
  const emailAddress = Mailbox.uniqueAddress();

  const signup = new SignupPage(page);
  await signup.goto();
  await signup.signup('E Two E', 'User', emailAddress, TEST_PASSWORD);

  if (!IS_LOCAL) {
    await signup.expectVerificationPrompt();
    const code = await Mailbox.getVerificationCode(emailAddress);
    const verify = new VerifyEmailPage(page);
    await verify.verify(code);
  }

  await page.context().clearCookies();
  const login = new LoginPage(page);
  await login.goto();
  await login.login(emailAddress, TEST_PASSWORD);
  await login.expectLoggedIn();

  return { email: emailAddress, password: TEST_PASSWORD };
}
