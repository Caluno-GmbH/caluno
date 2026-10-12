import { MembershipRequestStatus } from '@repo/data';
import { idsSharingTitleAndDay } from '@/lib/formatting/relative-day';

/** Preview size for a stacked section: three cards, then See all. */
export const OVERVIEW_SECTION_PREVIEW_LIMIT = 3;

/** Fill upcoming assignments spans both columns, so its preview is a 2×2. */
export const FILL_OPEN_ASSIGNMENTS_PREVIEW_LIMIT = 4;

/**
 * Task types the query can return. Timesheet bundles stay in this list so
 * the sidebar count is unchanged, and stay off the board.
 */
export const OVERVIEW_TASK_TYPES = [
  'MEMBERSHIP_REQUEST',
  'SHIFT_BELOW_MINIMUM',
  'SHIFT_APPROVAL',
  'EVENT_APPROVAL',
  'CONTRACT_SIGN',
  'TIMESHEET_SIGN',
  'TIMESHEET_BUNDLES',
  'DOCUMENT_DECLINED',
] as const;

export type OverviewTaskType = (typeof OVERVIEW_TASK_TYPES)[number];

export const OVERVIEW_SECTION_IDS = [
  'FILL_OPEN_ASSIGNMENTS',
  'REVIEW_APPLICATIONS',
  'APPROVE_SIGNUPS',
  'DECLINED_DOCUMENTS',
  'COUNTERSIGN_DOCUMENTS',
] as const;

export type OverviewSectionId = (typeof OVERVIEW_SECTION_IDS)[number];

export const OVERVIEW_GROUP_IDS = [
  'volunteersAndShifts',
  'accounting',
] as const;

export type OverviewGroupId = (typeof OVERVIEW_GROUP_IDS)[number];

const SECTION_SOURCES: Record<OverviewSectionId, readonly OverviewTaskType[]> =
  {
    FILL_OPEN_ASSIGNMENTS: ['SHIFT_BELOW_MINIMUM'],
    REVIEW_APPLICATIONS: ['MEMBERSHIP_REQUEST'],
    APPROVE_SIGNUPS: ['SHIFT_APPROVAL', 'EVENT_APPROVAL'],
    DECLINED_DOCUMENTS: ['DOCUMENT_DECLINED'],
    COUNTERSIGN_DOCUMENTS: ['CONTRACT_SIGN', 'TIMESHEET_SIGN'],
  };

/** Sections that span every column of their group. They keep a container when empty. */
export function sectionSpansColumns(id: OverviewSectionId): boolean {
  return id === 'FILL_OPEN_ASSIGNMENTS';
}

/** Board order. A group is omitted when every section in it is empty. */
const OVERVIEW_BOARD: ReadonlyArray<{
  id: OverviewGroupId;
  sections: readonly OverviewSectionId[];
}> = [
  {
    id: 'volunteersAndShifts',
    sections: [
      'FILL_OPEN_ASSIGNMENTS',
      'APPROVE_SIGNUPS',
      'REVIEW_APPLICATIONS',
    ],
  },
  {
    id: 'accounting',
    sections: ['DECLINED_DOCUMENTS', 'COUNTERSIGN_DOCUMENTS'],
  },
];

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
  /** ISO timestamp used to order a merged list. */
  sortAt?: string;
  /** Raw reimbursement type key, when the card carries one. */
  reimbursementTypeKey?: string;
  /** Agreement or timesheet, for document cards. */
  documentKind?: 'contract' | 'invoice';
}

export interface OverviewSection {
  id: OverviewSectionId;
  tasks: OverviewTask[];
}

export interface OverviewGroup {
  id: OverviewGroupId;
  sections: OverviewSection[];
}

export function isOverviewTaskType(type: string): type is OverviewTaskType {
  return (OVERVIEW_TASK_TYPES as readonly string[]).includes(type);
}

const OVERVIEW_SECTION_SLUG: Record<OverviewSectionId, string> = {
  FILL_OPEN_ASSIGNMENTS: 'shifts-below-minimum',
  REVIEW_APPLICATIONS: 'membership-requests',
  APPROVE_SIGNUPS: 'sign-ups',
  DECLINED_DOCUMENTS: 'declined-documents',
  COUNTERSIGN_DOCUMENTS: 'countersign',
};

/** Earlier see-all paths open the merged section that replaced them. */
const LEGACY_SECTION_SLUG: Record<string, OverviewSectionId> = {
  'shift-requests': 'APPROVE_SIGNUPS',
  'event-requests': 'APPROVE_SIGNUPS',
  contracts: 'COUNTERSIGN_DOCUMENTS',
  timesheets: 'COUNTERSIGN_DOCUMENTS',
};

export function overviewSectionHref(
  orgUId: string,
  id: OverviewSectionId,
): string {
  if (id === 'REVIEW_APPLICATIONS') {
    return `/admin/${orgUId}/volunteers?status=${MembershipRequestStatus.Pending}`;
  }
  return `/admin/${orgUId}/overview/${OVERVIEW_SECTION_SLUG[id]}`;
}

export function overviewSectionIdFromSlug(
  slug: string,
): OverviewSectionId | null {
  const current = OVERVIEW_SECTION_IDS.find(
    (id) => OVERVIEW_SECTION_SLUG[id] === slug,
  );
  return current ?? LEGACY_SECTION_SLUG[slug] ?? null;
}

/**
 * Non-empty sections under their subheaders. Merged sections are one list,
 * soonest sign-up or oldest document first, and their count is the sum.
 */
export function groupOverviewBoard(
  tasks: OverviewTask[],
  options?: { keepEmptyFill?: boolean },
): OverviewGroup[] {
  if (tasks.length === 0) {
    if (!options?.keepEmptyFill) return [];
    return [
      {
        id: 'volunteersAndShifts',
        sections: [{ id: 'FILL_OPEN_ASSIGNMENTS', tasks: [] }],
      },
    ];
  }
  return OVERVIEW_BOARD.flatMap((group) => {
    const sections = group.sections.flatMap((id) => {
      const sources = new Set(SECTION_SOURCES[id]);
      const sectionTasks = tasks
        .filter((task) => sources.has(task.type))
        .sort(bySortAt);
      if (sectionTasks.length === 0 && !sectionSpansColumns(id)) return [];
      return [{ id, tasks: sectionTasks }];
    });
    if (sections.length === 0) return [];
    return [{ id: group.id, sections }];
  });
}

function bySortAt(a: OverviewTask, b: OverviewTask): number {
  const left = a.sortAt ?? '\uffff';
  const right = b.sortAt ?? '\uffff';
  if (left === right) return a.id.localeCompare(b.id);
  return left < right ? -1 : 1;
}

export function sectionPreviewLimit(id: OverviewSectionId): number {
  if (id === 'FILL_OPEN_ASSIGNMENTS')
    return FILL_OPEN_ASSIGNMENTS_PREVIEW_LIMIT;
  return OVERVIEW_SECTION_PREVIEW_LIMIT;
}

export function visibleSectionTasks(
  tasks: OverviewTask[],
  expanded: boolean,
  limit = OVERVIEW_SECTION_PREVIEW_LIMIT,
): OverviewTask[] {
  if (expanded) return tasks;
  return tasks.slice(0, limit);
}

export function sectionCanExpand(tasks: OverviewTask[]): boolean {
  return tasks.length > OVERVIEW_SECTION_PREVIEW_LIMIT;
}

/** Visible cards that share a title on the same day, so both show a start time. */
export function taskIdsWithStartTime(
  tasks: readonly OverviewTask[],
): Set<string> {
  return idsSharingTitleAndDay(
    tasks.map((task) => ({
      id: task.id,
      title: task.details.find((detail) => detail.key === 'title')?.value,
      startsAt: task.details.find((detail) => detail.key === 'startsAt')?.value,
    })),
  );
}
