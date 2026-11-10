import {
  ADMIN_NAV_ITEM,
  ADMIN_NAV_SECTION,
} from '@/components/navigation/admin-nav';
import type {
  EeExtensions,
  EeNavContext,
} from '@/edition/enterprise-extensions';

/**
 * EE frontend extensions manifest. `loadEeExtensions()`
 * (`@/edition/load-ee-extensions`) dynamically imports this module when the
 * edition flag is set. Server-only: do not import from Client Components —
 * the org layout passes serializable `nav(…)` into the sidebar, and badges
 * load from `@/ee/count-badges`, so server page slots here never enter the
 * client graph. A new EE nav contribution, inline slot, or page is added
 * here (nav via `./nav`) — `<EeSlot />` / `<EePage />` call sites never change.
 *
 * Nav placement with `before` (omit → append as last in the target section).
 * `href` is the full app path. `countBadge` is a string key resolved
 * client-side via `@/ee/count-badges`.
 *
 * Slot loaders should prefer `() => import('./…')` so optional
 * `generateMetadata` on the module is available to `eePageMetadata`.
 */
export const eeExtensions: EeExtensions = {
  nav: ({ orgUId }: EeNavContext) => [
    {
      kind: 'item',
      id: ADMIN_NAV_ITEM.todo,
      section: ADMIN_NAV_SECTION.menu,
      before: ADMIN_NAV_ITEM.events,
      titleKey: 'todo',
      href: `/admin/${orgUId}`,
      icon: 'list-todo',
      countBadge: 'todo',
    },
  ],
  slots: {
    'todo-page': () => import('./todo/todo-page'),
    'todo-section-page': () => import('./todo/todo-section-page'),
  },
};
