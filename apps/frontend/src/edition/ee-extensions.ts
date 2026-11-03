import type { ComponentType } from 'react';
import type { EeIconName } from './ee-icons';

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
 * Add a new EE nav item or UI slot by extending `src/ee/index.ts` —
 * `dashboard-sidebar.tsx` and the page/slot call sites never change.
 */
export interface EeExtensions {
  navItems?: EeNavItem[];
  /** Keyed by a call-site-chosen slot name, e.g. `'profile-note'`. */
  slots?: Record<string, EeSlotLoader>;
}
