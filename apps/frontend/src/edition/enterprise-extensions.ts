import type { ComponentType } from 'react';
import type { EeIconName } from './enterprise-icons';

export interface EeNavItem {
  titleKey: string;
  /** Appended to `/admin/{orgUId}`, e.g. `/my-note`. */
  href: string;
  icon: EeIconName;
}

export type EeSlotLoader = () => Promise<ComponentType>;

/**
 * Contract for optional EE-only frontend additions.
 * `src/ee/index.ts` implements this when present (hosted / private builds);
 * OSS mirrors have no `ee/` directory, so `loadEeExtensions()` resolves to
 * `null` and every OSS call site renders/behaves as if EE did not exist.
 * Add a new EE nav item, inline slot, or page by extending `src/ee/index.ts` —
 * `dashboard-sidebar.tsx` and `<EeSlot />` / `<EePage />` call sites never change.
 */
export interface EeExtensions {
  navItems?: EeNavItem[];
  /**
   * Keyed by a call-site-chosen name. Used by both `<EeSlot />` (inline, null
   * when absent) and `<EePage />` (App Router stub, `notFound` when absent),
   * e.g. `'profile-note'`, `'my-note-page'`.
   */
  slots?: Record<string, EeSlotLoader>;
}
