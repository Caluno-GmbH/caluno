import {
  ADMIN_NAV_ITEM,
  ADMIN_NAV_SECTION,
} from '@/components/navigation/admin-nav';
import type { EeExtensions } from '@/edition/enterprise-extensions';

/**
 * EE frontend extensions manifest. `loadEeExtensions()`
 * (`@/edition/load-ee-extensions`) dynamically imports this module when the
 * edition flag is set. A new EE nav contribution, inline slot, or page is
 * added here only — `dashboard-sidebar.tsx` and `<EeSlot />` / `<EePage />`
 * call sites never change.
 *
 * Nav placement with `before` (omit → append as last in the target section).
 * `href` is the full app path.
 *
 * Example nav
 * [
 * {
 *   kind: 'section',
 *   id: 'private',
 *   labelKey: 'private',
 *   before: ADMIN_NAV_SECTION.accounting,
 *   items: [
 *     {
 *       id: 'my-note',
 *       titleKey: 'myNote',
 *       href: `/admin/${orgUId}/my-note`,
 *       icon: 'notebook-pen',
 *     },
 *   ],
 * },
 * {
 *   kind: 'item',
 *   id: 'my-note',
 *   section: ADMIN_NAV_SECTION.menu,
 *   before: ADMIN_NAV_ITEM.shifts,
 *   titleKey: 'myNote',
 *   href: `/admin/${orgUId}/my-note`,
 *   icon: 'notebook-pen',
 * },
 * ]
 *
 * slots map from string to component used in EeSlot or EePage. e.g.
 *     'profile-note': () =>
 *       import('./note/profile-note-section').then((m) => m.ProfileNoteSection),
 */
export const eeExtensions: EeExtensions = {
  nav: ({ orgUId }) => [],
  slots: {},
};
