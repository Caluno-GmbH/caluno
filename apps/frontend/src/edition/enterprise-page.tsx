import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { resolveLocale } from '@/i18n/routing';
import type { EeSlotProps } from './enterprise-extensions';
import { resolveEeSlotComponent } from './enterprise-slot';

/**
 * App Router stub for an EE-only page. Resolves a named slot from
 * `src/ee/index.ts` and 404s when EE/the slot is absent — same registry as
 * `<EeSlot />`, different empty behaviour (`notFound` vs render nothing).
 * A new EE page needs a `slots` entry plus a thin `page.tsx` that renders
 * `<EePage ee="..." params={params} searchParams={searchParams} />`.
 * `searchParams` (when provided) and any extra props (anything except `ee` /
 * `params` / `searchParams`) are spread onto the loaded component.
 */
export async function EePage({
  ee,
  params,
  searchParams,
  ...props
}: {
  ee: string;
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} & EeSlotProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);

  const Component = await resolveEeSlotComponent(ee);
  if (!Component) {
    notFound();
  }
  return (
    <Component
      {...props}
      {...(searchParams !== undefined ? { searchParams } : {})}
    />
  );
}
