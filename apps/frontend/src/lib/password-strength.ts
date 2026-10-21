import {
  levelForScore,
  type PasswordStrengthLevel,
} from '@repo/password-policy';
import type { ZxcvbnFactory } from '@zxcvbn-ts/core';

/**
 * Mirrors the backend policy in `apps/backend/src/auth/password-policy.ts` so the
 * meter and the server agree on which passwords will be accepted. The rule
 * constants live in `@repo/password-policy`; only the zxcvbn instance differs
 * (lazily imported here, eager on the server).
 */
export interface PasswordStrengthResult {
  score: number;
  level: PasswordStrengthLevel;
}

let checker: Promise<ZxcvbnFactory> | null = null;

async function createChecker(): Promise<ZxcvbnFactory> {
  const [core, common, en, de] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
    import('@zxcvbn-ts/language-de'),
  ]);

  return new core.ZxcvbnFactory({
    dictionary: {
      ...common.dictionary,
      ...en.dictionary,
      ...de.dictionary,
    },
    graphs: common.adjacencyGraphs,
  });
}

function checkerFor(): Promise<ZxcvbnFactory> {
  if (checker) {
    return checker;
  }

  const pending = createChecker();
  checker = pending;
  // A failed chunk load must not poison the cache: drop it so the next
  // keystroke retries.
  pending.catch(() => {
    if (checker === pending) {
      checker = null;
    }
  });

  return pending;
}

/**
 * Scores a password locally with zxcvbn, using the same dictionaries and the
 * same personal details the backend passes in.
 */
export async function scorePassword(
  password: string,
  userInputs: readonly string[],
): Promise<PasswordStrengthResult> {
  const zxcvbn = await checkerFor();
  const inputs = userInputs.map((input) => input.trim()).filter(Boolean);
  const { score } = zxcvbn.check(password, inputs);

  return {
    score,
    level: levelForScore(score),
  };
}
