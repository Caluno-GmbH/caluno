import type { EeExtensions } from '@/edition/enterprise-extensions';
import { eeNav } from './nav';

/**
 * EE frontend extensions manifest. `loadEeExtensions()`
 * (`@/edition/load-ee-extensions`) dynamically imports this module when the
 * edition flag is set. Server-only: do not import from Client Components —
 * the sidebar loads nav via `@/ee/nav` so server page slots here never enter
 * the client graph. A new EE nav contribution, inline slot, or page is added
 * here (nav via `./nav`) — `<EeSlot />` / `<EePage />` call sites never change.
 *
 * Nav placement with `before` (omit → append as last in the target section).
 * `href` is the full app path. `CountBadge` is supported — merge happens
 * client-side in the sidebar so components are not RSC-serialized.
 *
 * Slot loaders should prefer `() => import('./…')` so optional
 * `generateMetadata` on the module is available to `eePageMetadata`.
 */
export const eeExtensions: EeExtensions = {
  nav: eeNav,
  slots: {
    'todo-page': () => import('./todo/todo-page'),
    'todo-section-page': () => import('./todo/todo-section-page'),
  },
};
