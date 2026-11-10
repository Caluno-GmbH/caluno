import {
  ADMIN_NAV_ITEM,
  ADMIN_NAV_SECTION,
} from '@/components/navigation/admin-nav';
import type {
  EeExtensions,
  EeNavContext,
} from '@/edition/enterprise-extensions';

/**
 * Serializable EE nav entry. The org layout calls this via `eeExtensions.nav`
 * and passes the result into the client sidebar. Keep free of Client Component
 * imports and `next/headers` — badges are string keys resolved client-side
 * from `@/ee/count-badges`. Full `eeExtensions` (including server page slots)
 * lives in `./index`.
 */
export const eeNav: NonNullable<EeExtensions['nav']> = ({
  orgUId,
}: EeNavContext) => [
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
];
