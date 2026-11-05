import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { resolveLocale } from '@/i18n/routing';
import { resolveEeSlotComponent } from './enterprise-slot';

/**
 * App Router stub for an EE-only page. Resolves a named slot from
 * `src/ee/index.ts` and 404s when EE/the slot is absent — same registry as
 * `<EeSlot />`, different empty behaviour (`notFound` vs render nothing).
 * A new EE page needs a `slots` entry plus a thin `page.tsx` that renders
 * `<EePage name="..." params={params} />`.
 */
export async function EePage({
  name,
  params,
}: {
  name: string;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);

  const Component = await resolveEeSlotComponent(name);
  if (!Component) {
    notFound();
  }
  return <Component />;
}
