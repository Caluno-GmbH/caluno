import { MIN_PASSWORD_LENGTH, MIN_PASSWORD_SCORE } from '@repo/password-policy';
import { type OptionsType, ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnDe from '@zxcvbn-ts/language-de';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';

export const PASSWORD_TOO_SHORT = 'PASSWORD_TOO_SHORT';
export const PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK';

export interface PasswordPolicyViolation {
  code: typeof PASSWORD_TOO_SHORT | typeof PASSWORD_TOO_WEAK;
  message: string;
}

const zxcvbnOptions: OptionsType = {
  dictionary: {
    ...zxcvbnCommon.dictionary,
    ...zxcvbnEn.dictionary,
    ...zxcvbnDe.dictionary,
  },
  graphs: zxcvbnCommon.adjacencyGraphs,
};

const zxcvbn = new ZxcvbnFactory(zxcvbnOptions);

/**
 * Checks a password that is about to be set. Context strings (email, name, ...)
 * are passed to zxcvbn so passwords derived from them score lower.
 *
 * Returns `null` when the password is acceptable.
 */
export function checkPasswordPolicy(
  password: string,
  userInputs: readonly string[] = [],
): PasswordPolicyViolation | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      code: PASSWORD_TOO_SHORT,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  const { score } = zxcvbn.check(password, [...userInputs]);

  if (score < MIN_PASSWORD_SCORE) {
    return {
      code: PASSWORD_TOO_WEAK,
      message: 'Please choose a stronger password',
    };
  }

  return null;
}
