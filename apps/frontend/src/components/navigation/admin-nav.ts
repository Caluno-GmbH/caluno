import { PermissionKey } from '@repo/data';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  CalendarCog,
  CalendarIcon,
  ClipboardListIcon,
  ClockIcon,
  CoinsIcon,
  HeartHandshake,
  LayoutListIcon,
  ListTodo,
  NetworkIcon,
  ScanQrCode,
  ShieldIcon,
  TicketIcon,
  UsersIcon,
} from 'lucide-react';
import type { EeNavContribution } from '@/edition/enterprise-extensions';
import { EE_ICONS } from '@/edition/enterprise-icons';

/** Stable section ids EE (and tests) can target. */
export const ADMIN_NAV_SECTION = {
  menu: 'menu',
  accounting: 'accounting',
  settings: 'settings',
  shortcuts: 'shortcuts',
} as const;

/** Stable item ids within OSS sections. */
export const ADMIN_NAV_ITEM = {
  todo: 'todo',
  events: 'events',
  shifts: 'shifts',
  timesheets: 'timesheets',
  volunteers: 'volunteers',
  requirementForms: 'requirementForms',
  reimbursements: 'reimbursements',
  accountingSettings: 'accountingSettings',
  roles: 'roles',
  orgUnits: 'orgUnits',
  shiftSettings: 'shiftSettings',
  checkVolunteersIn: 'checkVolunteersIn',
  volunteeringApp: 'volunteeringApp',
} as const;

export type AdminNavLabelNamespace = 'Common' | 'Navigation';

export interface AdminNavItem {
  id: string;
  titleKey: string;
  href: string;
  icon: LucideIcon;
  count?: number;
  trailingIcon?: LucideIcon;
  /** When set, item is shown only if this returns true. Missing → shown. */
  show?: () => boolean;
}

export interface AdminNavSection {
  id: string;
  labelNamespace: AdminNavLabelNamespace;
  labelKey: string;
  items: AdminNavItem[];
  /** When set, section is shown only if this returns true. Missing → shown. */
  show?: () => boolean;
}

export interface BuildAdminNavContext {
  orgUId: string;
  waitingCount: number;
  pendingCount: number | undefined;
  accountingEnabled: boolean;
  permissionSet: ReadonlySet<PermissionKey>;
}

/**
 * Insert `entry` before the item with id `before`, or append when `before` is
 * missing / unknown.
 */
export function insertBefore<T extends { id: string }>(
  list: readonly T[],
  entry: T,
  before?: string,
): T[] {
  if (!before) return [...list, entry];
  const idx = list.findIndex((item) => item.id === before);
  if (idx === -1) return [...list, entry];
  return [...list.slice(0, idx), entry, ...list.slice(idx)];
}

/** OSS admin sidebar sections (always emitted; visibility via `show`). */
export function buildAdminNav(ctx: BuildAdminNavContext): AdminNavSection[] {
  const {
    orgUId,
    waitingCount,
    pendingCount,
    accountingEnabled,
    permissionSet,
  } = ctx;

  return [
    {
      id: ADMIN_NAV_SECTION.menu,
      labelNamespace: 'Common',
      labelKey: 'menu',
      items: [
        {
          id: ADMIN_NAV_ITEM.todo,
          titleKey: 'todo',
          href: `/admin/${orgUId}`,
          icon: ListTodo,
          count: waitingCount,
        },
        {
          id: ADMIN_NAV_ITEM.events,
          titleKey: 'events',
          href: `/admin/${orgUId}/events`,
          icon: TicketIcon,
        },
        {
          id: ADMIN_NAV_ITEM.shifts,
          titleKey: 'shifts',
          href: `/admin/${orgUId}/shifts`,
          icon: CalendarIcon,
        },
        {
          id: ADMIN_NAV_ITEM.timesheets,
          titleKey: 'timesheets',
          href: `/admin/${orgUId}/timesheets`,
          icon: ClockIcon,
        },
        {
          id: ADMIN_NAV_ITEM.volunteers,
          titleKey: 'volunteers',
          href: `/admin/${orgUId}/volunteers`,
          icon: UsersIcon,
          count: pendingCount,
        },
        {
          id: ADMIN_NAV_ITEM.requirementForms,
          titleKey: 'requirementForms',
          href: `/admin/${orgUId}/requirement-forms`,
          icon: ClipboardListIcon,
        },
      ],
    },
    {
      id: ADMIN_NAV_SECTION.accounting,
      labelNamespace: 'Navigation',
      labelKey: 'accounting',
      show: () =>
        accountingEnabled && permissionSet.has(PermissionKey.AccountingManage),
      items: [
        {
          id: ADMIN_NAV_ITEM.reimbursements,
          titleKey: 'reimbursements',
          href: `/admin/${orgUId}/accounting/reimbursements`,
          icon: LayoutListIcon,
        },
        {
          id: ADMIN_NAV_ITEM.accountingSettings,
          titleKey: 'accountingSettings',
          href: `/admin/${orgUId}/accounting/settings`,
          icon: CoinsIcon,
        },
      ],
    },
    {
      id: ADMIN_NAV_SECTION.settings,
      labelNamespace: 'Navigation',
      labelKey: 'organizationSettings',
      show: () => permissionSet.has(PermissionKey.OrgView),
      items: [
        {
          id: ADMIN_NAV_ITEM.roles,
          titleKey: 'roles',
          href: `/admin/${orgUId}/settings/roles`,
          icon: ShieldIcon,
        },
        {
          id: ADMIN_NAV_ITEM.orgUnits,
          titleKey: 'orgUnits',
          href: `/admin/${orgUId}/settings/org-units`,
          icon: NetworkIcon,
        },
        {
          id: ADMIN_NAV_ITEM.shiftSettings,
          titleKey: 'shiftSettings',
          href: `/admin/${orgUId}/settings/shifts`,
          icon: CalendarCog,
        },
      ],
    },
    {
      id: ADMIN_NAV_SECTION.shortcuts,
      labelNamespace: 'Navigation',
      labelKey: 'shortcuts',
      items: [
        {
          id: ADMIN_NAV_ITEM.checkVolunteersIn,
          titleKey: 'checkVolunteersIn',
          href: '/check-in',
          icon: ScanQrCode,
          trailingIcon: ArrowUpRight,
        },
        {
          id: ADMIN_NAV_ITEM.volunteeringApp,
          titleKey: 'volunteeringApp',
          href: `/`,
          icon: HeartHandshake,
          trailingIcon: ArrowUpRight,
        },
      ],
    },
  ];
}

/**
 * Drop sections/items whose `show` returns false (missing `show` → keep).
 * Also drops sections that end up with no visible items.
 */
export function visibleAdminNav(
  sections: readonly AdminNavSection[],
): AdminNavSection[] {
  return sections
    .filter((section) => section.show?.() ?? true)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.show?.() ?? true),
    }))
    .filter((section) => section.items.length > 0);
}

function toAdminItem(item: {
  id: string;
  titleKey: string;
  href: string;
  icon: keyof typeof EE_ICONS;
}): AdminNavItem {
  return {
    id: item.id,
    titleKey: item.titleKey,
    href: item.href,
    icon: EE_ICONS[item.icon],
  };
}

/**
 * Apply EE nav contributions onto an OSS base menu.
 * Unknown `before` anchors append. Empty/undefined contributions are a no-op.
 */
export function mergeAdminNav(
  base: readonly AdminNavSection[],
  contributions: readonly EeNavContribution[] | undefined,
): AdminNavSection[] {
  if (!contributions?.length) return [...base];

  let sections = base.map((section) => ({
    ...section,
    items: [...section.items],
  }));

  for (const contribution of contributions) {
    if (contribution.kind === 'item') {
      const sectionIdx = sections.findIndex(
        (section) => section.id === contribution.section,
      );
      if (sectionIdx === -1) continue;

      const section = sections[sectionIdx];
      if (!section) continue;

      sections[sectionIdx] = {
        ...section,
        items: insertBefore(
          section.items,
          toAdminItem(contribution),
          contribution.before,
        ),
      };
      continue;
    }

    let items: AdminNavItem[] = [];
    for (const item of contribution.items) {
      items = insertBefore(items, toAdminItem(item), item.before);
    }

    sections = insertBefore(
      sections,
      {
        id: contribution.id,
        labelNamespace: 'Navigation' as const,
        labelKey: contribution.labelKey,
        items,
      },
      contribution.before,
    );
  }

  return sections;
}
