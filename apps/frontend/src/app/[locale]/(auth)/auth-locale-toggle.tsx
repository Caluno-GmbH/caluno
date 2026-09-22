'use client';

import { Button } from '@repo/ui';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { otherLocale } from './other-locale';

/**
 * Logged-out locale switch for auth pages. Navigates to the other URL prefix
 * only — no preference cookie (proxy ignores cookies without a session).
 */
export function AuthLocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('Auth');
  const next = otherLocale(locale);
  const label = next.toUpperCase();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="absolute top-4 right-4 font-medium tracking-wide text-muted-foreground"
      aria-label={t('switchLocale', { locale: label })}
      onClick={() => router.replace(pathname, { locale: next })}
    >
      {label}
    </Button>
  );
}
