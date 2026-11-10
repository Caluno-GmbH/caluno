import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { ComponentType } from 'react';
import { resolveLocale } from '@/i18n/routing';
import type {
  EditionPageMetaProps,
  EeSlotProps,
} from './enterprise-extensions';
import { resolveEeSlotComponent, resolveEeSlotModule } from './enterprise-slot';

type EditionPageGenerateMetadata = (
  props: EditionPageMetaProps,
) => Promise<Metadata>;

type EePageMetadataOptions = {
  ee: string;
  /** OSS `generateMetadata` when the EE slot is absent. */
  fallback?: EditionPageGenerateMetadata;
};

/**
 * App Router `generateMetadata` for an `<EePage />` stub. Resolves the EE
 * slot module (or static OSS fallback) and delegates to its `generateMetadata`
 * when present. Next only honors this export on the route file — keep the
 * stub as `export const generateMetadata = eePageMetadata({ … })`.
 */
export function eePageMetadata({ ee, fallback }: EePageMetadataOptions) {
  return async function generateMetadata(
    props: EditionPageMetaProps,
  ): Promise<Metadata> {
    const mod = await resolveEeSlotModule(ee);
    const generate = mod?.generateMetadata ?? fallback;
    if (!generate) {
      return {};
    }
    return generate(props);
  };
}

/**
 * App Router stub for an EE page slot. Resolves a named slot from
 * `src/ee/index.ts`. When EE/the slot is absent: render the static OSS
 * `fallback` component if provided, otherwise `notFound()`.
 * A new EE page needs a `slots` entry plus a thin `page.tsx`:
 * `<EePage ee="…" params={params} />` or with
 * `fallback={OssPage}` when OSS ships a core page at the same URL.
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
  /** OSS page component when the EE slot is absent. */
  // biome-ignore lint/suspicious/noExplicitAny: matches EditionPageModule.default
  fallback?: ComponentType<any>;
} & EeSlotProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);

  const slotProps = {
    params,
    ...props,
    ...(searchParams !== undefined ? { searchParams } : {}),
  };

  const Component = (await resolveEeSlotComponent(ee)) ?? fallback;
  if (!Component) {
    notFound();
  }
  return <Component {...slotProps} />;
}
