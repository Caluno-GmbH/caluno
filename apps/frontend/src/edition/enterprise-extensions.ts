import type { ComponentType } from 'react';
import type { EeIconName } from './enterprise-icons';

/** Extra props forwarded from `<EeSlot ee="…" … />` / `<EePage ee="…" … />`. */
export type EeSlotProps = Record<string, unknown>;

export type EeSlotLoader = () => Promise<ComponentType<EeSlotProps>>;

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
}

export interface EeNavSectionItem {
  id: string;
  titleKey: string;
  href: string;
  icon: EeIconName;
  /** Item id within this new section; omit → last. */
  before?: string;
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
 * Add a new EE nav contribution, inline slot, or page by extending
 * `src/ee/index.ts` — `dashboard-sidebar.tsx` and `<EeSlot />` / `<EePage />`
 * call sites never change.
 */
export interface EeNavContext {
  orgUId: string;
}

export interface EeExtensions {
  /**
   * Admin sidebar contributions: insert items into existing sections or add
   * new sections. Placement is `before`-only (omit → append).
   * Factory receives `orgUId` so hrefs can be absolute app paths (no auto-prefix).
   */
  nav?: (ctx: EeNavContext) => EeNavContribution[];
  /**
   * Keyed by a call-site-chosen name. Used by both `<EeSlot />` (inline, null
   * when absent) and `<EePage />` (App Router stub, `notFound` when absent),
   * e.g. `'some-page'`.
   */
  slots?: Record<string, EeSlotLoader>;
}
