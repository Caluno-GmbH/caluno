import {
  ADMIN_NAV_ITEM,
  ADMIN_NAV_SECTION,
} from '@/components/navigation/admin-nav';
import type { EeNavContribution } from '@/edition/enterprise-extensions';
import { TodoNavCountBadge } from './todo-nav-count-badge';

export function todoNavContributions(orgUId: string): EeNavContribution[] {
  return [
    {
      kind: 'item',
      id: ADMIN_NAV_ITEM.todo,
      section: ADMIN_NAV_SECTION.menu,
      before: ADMIN_NAV_ITEM.events,
      titleKey: 'todo',
      href: `/admin/${orgUId}`,
      icon: 'list-todo',
      CountBadge: TodoNavCountBadge,
    },
  ];
}
