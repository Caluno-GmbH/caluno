import { describe, expect, it } from 'bun:test';
import { MembershipRequestStatus } from '@repo/data';
import {
  FILL_OPEN_ASSIGNMENTS_PREVIEW_LIMIT,
  groupOverviewBoard,
  OVERVIEW_SECTION_IDS,
  OVERVIEW_SECTION_PREVIEW_LIMIT,
  type OverviewTask,
  type OverviewTaskType,
  overviewSectionHref,
  overviewSectionIdFromSlug,
  sectionCanExpand,
  sectionPreviewLimit,
  sectionSpansColumns,
  visibleSectionTasks,
} from './tasks';

function task(
  id: string,
  type: OverviewTaskType,
  sortAt?: string,
): OverviewTask {
  return {
    id,
    type,
    href: `/admin/tasks/${id}`,
    details: [{ key: 'id', value: id }],
    sortAt,
  };
}

describe('groupOverviewBoard', () => {
  it('groups sections under two subheaders and drops empty ones', () => {
    const groups = groupOverviewBoard([
      task('m1', 'MEMBERSHIP_REQUEST', '2026-03-01'),
      task('s1', 'SHIFT_BELOW_MINIMUM', '2026-08-02'),
      task('s2', 'SHIFT_BELOW_MINIMUM', '2026-08-01'),
      task('signup', 'SHIFT_APPROVAL', '2026-08-03'),
      task('bundle', 'TIMESHEET_BUNDLES'),
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      'volunteersAndShifts',
      'accounting',
    ]);
    expect(groups[0]?.sections.map((section) => section.id)).toEqual([
      'FILL_OPEN_ASSIGNMENTS',
      'APPROVE_SIGNUPS',
      'REVIEW_APPLICATIONS',
    ]);
    expect(groups[0]?.sections[0]?.tasks.map((item) => item.id)).toEqual([
      's2',
      's1',
    ]);
    expect(groups[1]?.sections.map((section) => section.id)).toEqual([
      'SEND_TIMESHEET_BUNDLES',
    ]);
    expect(groups[1]?.sections[0]?.tasks.map((item) => item.id)).toEqual([
      'bundle',
    ]);
  });

  it('merges sign-ups soonest first and documents oldest first', () => {
    const groups = groupOverviewBoard([
      task('shift-late', 'SHIFT_APPROVAL', '2026-08-20T10:00:00.000Z'),
      task('event-soon', 'EVENT_APPROVAL', '2026-08-12T10:00:00.000Z'),
      task('contract-new', 'CONTRACT_SIGN', '2026-07-01T00:00:00.000Z'),
      task('timesheet-old', 'TIMESHEET_SIGN', '2026-02-01T00:00:00.000Z'),
      task('declined', 'DOCUMENT_DECLINED', '2026-01-01T00:00:00.000Z'),
    ]);

    const signups = groups[0]?.sections.find(
      (section) => section.id === 'APPROVE_SIGNUPS',
    );
    const documents = groups[1]?.sections.find(
      (section) => section.id === 'COUNTERSIGN_DOCUMENTS',
    );

    expect(signups?.tasks.map((item) => item.id)).toEqual([
      'event-soon',
      'shift-late',
    ]);
    expect(signups?.tasks).toHaveLength(2);
    expect(documents?.tasks.map((item) => item.id)).toEqual([
      'timesheet-old',
      'contract-new',
    ]);
    expect(groups[1]?.sections.map((section) => section.id)).toEqual([
      'DECLINED_DOCUMENTS',
      'COUNTERSIGN_DOCUMENTS',
    ]);
  });

  it('shows ready timesheet bundles under accounting send-out', () => {
    const groups = groupOverviewBoard([task('bundle', 'TIMESHEET_BUNDLES')]);

    expect(groups.map((group) => group.id)).toEqual([
      'volunteersAndShifts',
      'accounting',
    ]);
    expect(groups[0]?.sections.map((section) => section.id)).toEqual([
      'FILL_OPEN_ASSIGNMENTS',
    ]);
    expect(groups[0]?.sections[0]?.tasks).toEqual([]);
    expect(groups[1]?.sections.map((section) => section.id)).toEqual([
      'SEND_TIMESHEET_BUNDLES',
    ]);
  });

  it('hides a subheader when every section in it is empty', () => {
    const groups = groupOverviewBoard([
      task('shift', 'SHIFT_BELOW_MINIMUM', '2026-08-01'),
    ]);

    expect(groups.map((group) => group.id)).toEqual(['volunteersAndShifts']);
  });

  it('keeps an empty full-width section when the rest of the board has work', () => {
    const groups = groupOverviewBoard([
      task('declined', 'DOCUMENT_DECLINED', '2026-01-01'),
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      'volunteersAndShifts',
      'accounting',
    ]);
    expect(groups[0]?.sections.map((section) => section.id)).toEqual([
      'FILL_OPEN_ASSIGNMENTS',
    ]);
    expect(groups[0]?.sections[0]?.tasks).toEqual([]);
    expect(sectionSpansColumns('FILL_OPEN_ASSIGNMENTS')).toBe(true);
    expect(sectionSpansColumns('APPROVE_SIGNUPS')).toBe(false);
  });

  it('keeps the page empty when nothing is waiting', () => {
    expect(groupOverviewBoard([])).toEqual([]);
  });

  it('keeps an empty fill section when a shift editor has nothing waiting', () => {
    expect(groupOverviewBoard([], { keepEmptyFill: true })).toEqual([
      {
        id: 'volunteersAndShifts',
        sections: [{ id: 'FILL_OPEN_ASSIGNMENTS', tasks: [] }],
      },
    ]);
  });
});

describe('visibleSectionTasks', () => {
  const tasks = Array.from({ length: 5 }, (_, index) =>
    task(`t${index}`, 'SHIFT_APPROVAL'),
  );

  it('shows at most three cards until the section is expanded', () => {
    expect(visibleSectionTasks(tasks, false)).toHaveLength(
      OVERVIEW_SECTION_PREVIEW_LIMIT,
    );
    expect(sectionCanExpand(tasks)).toBe(true);
  });

  it('shows every card once expanded', () => {
    expect(visibleSectionTasks(tasks, true)).toHaveLength(5);
  });

  it('does not offer See more for a short section', () => {
    expect(sectionCanExpand(tasks.slice(0, 3))).toBe(false);
  });

  it('shows four fill-open cards and three everywhere else', () => {
    expect(sectionPreviewLimit('FILL_OPEN_ASSIGNMENTS')).toBe(
      FILL_OPEN_ASSIGNMENTS_PREVIEW_LIMIT,
    );
    expect(
      visibleSectionTasks(
        tasks,
        false,
        sectionPreviewLimit('FILL_OPEN_ASSIGNMENTS'),
      ),
    ).toHaveLength(4);
    expect(sectionPreviewLimit('REVIEW_APPLICATIONS')).toBe(
      OVERVIEW_SECTION_PREVIEW_LIMIT,
    );
    expect(sectionPreviewLimit('APPROVE_SIGNUPS')).toBe(
      OVERVIEW_SECTION_PREVIEW_LIMIT,
    );
    expect(sectionPreviewLimit('DECLINED_DOCUMENTS')).toBe(
      OVERVIEW_SECTION_PREVIEW_LIMIT,
    );
    expect(sectionPreviewLimit('COUNTERSIGN_DOCUMENTS')).toBe(
      OVERVIEW_SECTION_PREVIEW_LIMIT,
    );
    expect(sectionPreviewLimit('SEND_TIMESHEET_BUNDLES')).toBe(
      OVERVIEW_SECTION_PREVIEW_LIMIT,
    );
  });
});

describe('overview section pages', () => {
  it('sends review applications to the requested volunteers list', () => {
    expect(overviewSectionHref('org-1', 'REVIEW_APPLICATIONS')).toBe(
      `/admin/org-1/volunteers?status=${MembershipRequestStatus.Pending}`,
    );
  });

  it('gives every other section a stable see-all path', () => {
    for (const id of OVERVIEW_SECTION_IDS) {
      if (id === 'REVIEW_APPLICATIONS') continue;
      const href = overviewSectionHref('org-1', id);
      const slug = href.split('/').at(-1) ?? '';
      expect(overviewSectionIdFromSlug(slug)).toBe(id);
    }
    expect(overviewSectionIdFromSlug('shift-requests')).toBe('APPROVE_SIGNUPS');
    expect(overviewSectionIdFromSlug('contracts')).toBe(
      'COUNTERSIGN_DOCUMENTS',
    );
    expect(overviewSectionIdFromSlug('timesheet-bundles')).toBe(
      'SEND_TIMESHEET_BUNDLES',
    );
    expect(overviewSectionIdFromSlug('not-a-section')).toBeNull();
  });
});
