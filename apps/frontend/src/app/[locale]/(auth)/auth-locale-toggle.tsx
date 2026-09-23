'use client';

import { otherLocale } from '@repo/data';
import { Button } from '@repo/ui';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

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
    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
      <span>{t('switchLocale')}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-1 font-medium tracking-wide text-foreground"
        aria-label={`${t('switchLocale')} ${label}`}
        onClick={() => router.replace(pathname, { locale: next })}
      >
        {label}
      </Button>
    </div>
  );
}
