/** Preview size from the Overview wireframe: three cards, then See more. */
export const OVERVIEW_SECTION_PREVIEW_LIMIT = 3;

/**
 * Board order. Volunteer requests lead. Contracts expiring soon is omitted:
 * accounting has no such action yet.
 */
export const OVERVIEW_SECTION_ORDER = [
  'MEMBERSHIP_REQUEST',
  'SHIFT_BELOW_MINIMUM',
  'SHIFT_APPROVAL',
  'EVENT_APPROVAL',
  'CONTRACT_SIGN',
  'TIMESHEET_SIGN',
  'TIMESHEET_BUNDLES',
  'DOCUMENT_DECLINED',
] as const;

export type OverviewTaskType = (typeof OVERVIEW_SECTION_ORDER)[number];

export interface OverviewDetail {
  key: string;
  /** Already formatted for the active locale. */
  value: string;
}

export interface OverviewTask {
  id: string;
  type: OverviewTaskType;
  href: string;
  /** In the order the card shows them. */
  details: OverviewDetail[];
  /** Raw reimbursement type key, when the card carries one. */
  reimbursementTypeKey?: string;
  /** Agreement or timesheet, for document cards. */
  documentKind?: 'contract' | 'invoice';
}

export interface OverviewSection {
  type: OverviewTaskType;
  tasks: OverviewTask[];
}

export function isOverviewTaskType(type: string): type is OverviewTaskType {
  return (OVERVIEW_SECTION_ORDER as readonly string[]).includes(type);
}

const OVERVIEW_SECTION_SLUG: Record<OverviewTaskType, string> = {
  SHIFT_BELOW_MINIMUM: 'shifts-below-minimum',
  SHIFT_APPROVAL: 'shift-requests',
  EVENT_APPROVAL: 'event-requests',
  CONTRACT_SIGN: 'contracts',
  TIMESHEET_SIGN: 'timesheets',
  TIMESHEET_BUNDLES: 'timesheet-bundles',
  DOCUMENT_DECLINED: 'declined-documents',
  MEMBERSHIP_REQUEST: 'membership-requests',
};

export function overviewSectionHref(
  orgUId: string,
  type: OverviewTaskType,
): string {
  return `/admin/${orgUId}/overview/${OVERVIEW_SECTION_SLUG[type]}`;
}

export function overviewSectionTypeFromSlug(
  slug: string,
): OverviewTaskType | null {
  const match = OVERVIEW_SECTION_ORDER.find(
    (type) => OVERVIEW_SECTION_SLUG[type] === slug,
  );
  return match ?? null;
}

/** Groups tasks into non-empty sections, in the fixed section order. */
export function groupOverviewTasks(tasks: OverviewTask[]): OverviewSection[] {
  const byType = new Map<OverviewTaskType, OverviewTask[]>();
  for (const task of tasks) {
    const list = byType.get(task.type) ?? [];
    list.push(task);
    byType.set(task.type, list);
  }

  return OVERVIEW_SECTION_ORDER.flatMap((type) => {
    const sectionTasks = byType.get(type);
    if (!sectionTasks || sectionTasks.length === 0) return [];
    return [{ type, tasks: sectionTasks }];
  });
}

export function visibleSectionTasks(
  tasks: OverviewTask[],
  expanded: boolean,
): OverviewTask[] {
  if (expanded) return tasks;
  return tasks.slice(0, OVERVIEW_SECTION_PREVIEW_LIMIT);
}

export function sectionCanExpand(tasks: OverviewTask[]): boolean {
  return tasks.length > OVERVIEW_SECTION_PREVIEW_LIMIT;
}
