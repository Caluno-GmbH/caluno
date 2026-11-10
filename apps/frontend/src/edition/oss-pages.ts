import type { EditionPageModule } from './enterprise-extensions';

export type OssPageLoader = () => Promise<EditionPageModule>;

/**
 * Named OSS/core pages for `<EePage fallback="…" />`.
 * Keys are call-site strings (e.g. `'oss-welcome-page'`); values lazy-load
 * the page module (`default` + optional `generateMetadata`). Stays in the
 * OSS tree — never import from `@/ee`.
 */
export const ossPages: Record<string, OssPageLoader> = {
  'oss-welcome-page': () =>
    import('@/domain/admin-welcome/admin-welcome-page').then((m) => ({
      default: m.AdminWelcomePage,
      generateMetadata: m.generateMetadata,
    })),
};
