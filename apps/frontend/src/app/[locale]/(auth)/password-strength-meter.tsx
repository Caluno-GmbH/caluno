'use client';

import {
  MIN_PASSWORD_LENGTH,
  MIN_PASSWORD_SCORE,
  type PasswordStrengthLevel,
} from '@repo/password-policy';
import { cn } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  type PasswordStrengthResult,
  scorePassword,
} from '@/lib/password-strength';

const SEGMENTS = [0, 1, 2, 3] as const;

const LEVEL_BAR: Record<PasswordStrengthLevel, string> = {
  1: 'bg-destructive',
  2: 'bg-alert',
  3: 'bg-success/75',
  4: 'bg-success',
};

const LEVEL_LABEL: Record<
  PasswordStrengthLevel,
  'levels.weak' | 'levels.fair' | 'levels.good' | 'levels.strong'
> = {
  1: 'levels.weak',
  2: 'levels.fair',
  3: 'levels.good',
  4: 'levels.strong',
};

export interface PasswordStrengthMeterProps {
  password: string;
  /** Personal details that make a password easier to guess. */
  userInputs?: readonly string[];
  className?: string;
}

/**
 * Password feedback that mirrors the server-side policy: the strength hint
 * before typing, then the live meter so people see where they stand instead of
 * learning it from a rejected submit.
 */
export function PasswordStrengthMeter({
  password,
  userInputs = [],
  className,
}: PasswordStrengthMeterProps) {
  const t = useTranslations('Auth.passwordStrength');
  const [result, setResult] = useState<PasswordStrengthResult | null>(null);
  const [failed, setFailed] = useState(false);

  // A stable signature so the effect only re-scores when the password or one of
  // the personal details actually changes.
  const inputsKey = userInputs
    .map((input) => input.trim())
    .filter(Boolean)
    .join('\u0000');

  useEffect(() => {
    if (password.length === 0) {
      setResult(null);
      setFailed(false);
      return;
    }

    const inputs = inputsKey === '' ? [] : inputsKey.split('\u0000');
    let active = true;
    const timer = setTimeout(() => {
      void scorePassword(password, inputs)
        .then((next) => {
          if (active) {
            setResult(next);
            setFailed(false);
          }
        })
        .catch(() => {
          if (active) {
            setResult(null);
            setFailed(true);
          }
        });
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [password, inputsKey]);

  if (password.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        {t('hint')}
      </p>
    );
  }

  if (failed) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        {t('unavailable')}
      </p>
    );
  }

  const level = result?.level ?? null;
  const status = level ? t(LEVEL_LABEL[level]) : t('checking');
  const guidance =
    password.length < MIN_PASSWORD_LENGTH
      ? t('minimum')
      : result && result.score < MIN_PASSWORD_SCORE
        ? t('weak')
        : null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div aria-hidden="true" className="flex gap-1.5">
        {SEGMENTS.map((segment) => (
          <span
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out',
              level && segment < level ? LEVEL_BAR[level] : 'bg-muted',
            )}
          />
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-xs font-medium text-foreground"
        >
          {status}
        </p>
        {guidance ? (
          <p className="text-xs text-muted-foreground">{guidance}</p>
        ) : null}
      </div>
    </div>
  );
}
