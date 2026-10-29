/**
 * Password rules shared by the API and the web app, so the strength meter and
 * the server-side policy cannot drift apart. zxcvbn instances stay in each app
 * (eager on the server, lazily imported in the browser); only the rules live
 * here.
 */

/** Minimum length enforced by Better Auth and the policy hook. */
export const MIN_PASSWORD_LENGTH = 8;
/** Better Auth's default maximum; scrypt has no truncation limit. */
export const MAX_PASSWORD_LENGTH = 128;
/** zxcvbn scores range from 0 (guessable) to 4 (strong). */
export const MIN_PASSWORD_SCORE = 3;
export const MAX_PASSWORD_SCORE = 4;

export type PasswordStrengthLevel = 1 | 2 | 3 | 4;

export function levelForScore(score: number): PasswordStrengthLevel {
  if (score >= MAX_PASSWORD_SCORE) {
    return 4;
  }
  if (score === 3) {
    return 3;
  }
  if (score === 2) {
    return 2;
  }
  return 1;
}

/**
 * Collects the personal details that make a password easier to guess. The API
 * passes the sign-up body; the web app passes the same fields from its form, so
 * both sides score against identical inputs.
 */
export function passwordUserInputs(
  details: Record<string, unknown> | undefined,
): string[] {
  const inputs: string[] = [];

  for (const key of ['email', 'name', 'firstname', 'lastname']) {
    const value = details?.[key];
    if (typeof value === 'string' && value.trim() !== '') {
      inputs.push(value.trim());
    }
  }

  const email = details?.email;
  if (typeof email === 'string' && email.includes('@')) {
    const localPart = email.split('@')[0]?.trim();
    if (localPart) {
      inputs.push(localPart);
    }
  }

  return inputs;
}
