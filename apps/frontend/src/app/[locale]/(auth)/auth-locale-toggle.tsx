'use client';

import type { Locale } from '@repo/data';
import { SUPPORTED_LOCALES } from '@repo/data';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/** Default locale first, then the rest — e.g. DE | EN. */
const LOCALE_CODES: readonly Locale[] = [
  routing.defaultLocale,
  ...SUPPORTED_LOCALES.filter((locale) => locale !== routing.defaultLocale),
];

/**
 * Logged-out locale switch for auth pages. Navigates to the chosen URL prefix
 * only — no preference cookie (proxy ignores cookies without a session).
 */
export function AuthLocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('LocaleSwitcher');

  return (
    <nav
      aria-label={t('label')}
      className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      {LOCALE_CODES.map((code, index) => {
        const isActive = code === locale;
        const label = code.toUpperCase();

        return (
          <span key={code} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">|</span> : null}
            {isActive ? (
              <span
                aria-current="true"
                className="font-bold tracking-wide text-foreground"
              >
                {label}
              </span>
            ) : (
              <button
                type="button"
                className="tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => router.replace(pathname, { locale: code })}
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
