import type { Metadata } from 'next';
import type { ComponentType } from 'react';
import type { EeIconName } from './enterprise-icons';

/** Extra props forwarded from `<EeSlot ee="…" … />` / `<EePage ee="…" … />`. */
export type EeSlotProps = Record<string, unknown>;

/** Props Next passes to `generateMetadata` / page modules. */
export type EditionPageMetaProps = {
  params: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Page/slot module shape for EE slots and OSS fallback pages.
 * Loaders may still return a bare component (legacy / inline slots);
 * resolvers normalize to this shape.
 */
export type EditionPageModule = {
  /**
   * Page components take route-specific `params`. Loaders are dynamic imports;
   * use a wide props type so concrete pages assign without casts.
   */
  // biome-ignore lint/suspicious/noExplicitAny: dynamic edition page modules
  default: ComponentType<any>;
  generateMetadata?: (props: EditionPageMetaProps) => Promise<Metadata>;
};

export type EeSlotLoader = () => Promise<EditionPageModule>;

/**
 * Insert an item into an existing admin-nav section.
 * `before` is an item id in that section; omit to append as last.
 */
export interface EeNavItemContribution {
  kind: 'item';
  id: string;
  titleKey: string;
  /** App path as used by the sidebar Link, e.g. `/admin/${orgUId}/some-page`. */
  href: string;
  icon: EeIconName;
  /** Target section id (OSS anchors in `ADMIN_NAV_SECTION`). */
  section: string;
  /** Item id to insert before; omit → last in section. */
  before?: string;
  /**
   * Optional badge component. Must fetch its own data — the sidebar passes
   * nothing (no shared count/task context). Client-only.
   */
  CountBadge?: ComponentType;
}

export interface EeNavSectionItem {
  id: string;
  titleKey: string;
  href: string;
  icon: EeIconName;
  /** Item id within this new section; omit → last. */
  before?: string;
  CountBadge?: ComponentType;
}

/**
 * Add a whole admin-nav section.
 * `before` is a section id; omit to append as last section.
 */
export interface EeNavSectionContribution {
  kind: 'section';
  id: string;
  /** next-intl key under `Navigation` (EE copy lives in `messages/ee/`). */
  labelKey: string;
  /** Section id to insert before; omit → last section. */
  before?: string;
  items: EeNavSectionItem[];
}

export type EeNavContribution =
  | EeNavItemContribution
  | EeNavSectionContribution;

/**
 * Contract for optional EE-only frontend additions.
 * `src/ee/index.ts` implements this when present (hosted / private builds);
 * OSS mirrors have no `ee/` directory, so `loadEeExtensions()` resolves to
 * `null` and every OSS call site renders/behaves as if EE did not exist.
 * Add a new EE nav contribution in `src/ee/nav.ts` and slots/pages in
 * `src/ee/index.ts` — `dashboard-sidebar.tsx` (imports `@/ee/nav` only) and
 * `<EeSlot />` / `<EePage />` call sites never change.
 */
export interface EeNavContext {
  orgUId: string;
}

export interface EeExtensions {
  /**
   * Admin sidebar contributions: insert items into existing sections or add
   * new sections. Placement is `before`-only (omit → append).
   * Factory receives `orgUId` so hrefs can be absolute app paths (no auto-prefix).
   * May include `CountBadge` components — merge happens in the client sidebar
   * so components are not RSC-serialized.
   */
  nav?: (ctx: EeNavContext) => EeNavContribution[];
  /**
   * Keyed by a call-site-chosen name. Used by both `<EeSlot />` (inline, null
   * when absent) and `<EePage />` (App Router stub: optional named OSS
   * `fallback`, else `notFound` when absent), e.g. `'todo-page'`.
   * Prefer `() => import('./…')` so `generateMetadata` travels with the module.
   */
  slots?: Record<string, EeSlotLoader>;
}
