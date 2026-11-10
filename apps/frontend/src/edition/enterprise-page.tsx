import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { resolveLocale } from '@/i18n/routing';
import type {
  EditionPageMetaProps,
  EeSlotProps,
} from './enterprise-extensions';
import { resolveEditionPageModule } from './enterprise-slot';

type EePageOptions = {
  ee: string;
  /** Named OSS page key from `ossPages` (e.g. `'oss-welcome-page'`). */
  fallback?: string;
};

/**
 * App Router `generateMetadata` for an `<EePage />` stub. Resolves the EE
 * slot module (or named OSS fallback) and delegates to its `generateMetadata`
 * when present. Next only honors this export on the route file — keep the
 * stub as `export const generateMetadata = eePageMetadata({ … })`.
 */
export function eePageMetadata({ ee, fallback }: EePageOptions) {
  return async function generateMetadata(
    props: EditionPageMetaProps,
  ): Promise<Metadata> {
    const mod = await resolveEditionPageModule(ee, fallback);
    if (!mod?.generateMetadata) {
      return {};
    }
    return mod.generateMetadata(props);
  };
}

/**
 * App Router stub for an EE page slot. Resolves a named slot from
 * `src/ee/index.ts`. When EE/the slot is absent: render the named OSS
 * `fallback` from `ossPages` if provided, otherwise `notFound()`.
 * A new EE page needs a `slots` entry plus a thin `page.tsx`:
 * `<EePage ee="…" params={params} />` or with
 * `fallback="oss-…"` when OSS ships a core page at the same URL.
 * `params`, `searchParams` (when provided), and any extra props (anything
 * except `ee` / `fallback`) are spread onto the loaded component.
 */
export async function EePage<TParams extends { locale: string }>({
  ee,
  params,
  searchParams,
  fallback,
  ...props
}: {
  ee: string;
  params: Promise<TParams>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  /** Named OSS page key from `ossPages`. */
  fallback?: string;
} & EeSlotProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);

  const slotProps = {
    params,
    ...props,
    ...(searchParams !== undefined ? { searchParams } : {}),
  };

  const mod = await resolveEditionPageModule(ee, fallback);
  if (!mod) {
    notFound();
  }
  const Component = mod.default;
  return <Component {...slotProps} />;
}
