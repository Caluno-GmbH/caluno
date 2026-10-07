import { describe, expect, it } from 'bun:test';
import {
  groupOverviewTasks,
  OVERVIEW_SECTION_ORDER,
  OVERVIEW_SECTION_PREVIEW_LIMIT,
  type OverviewTask,
  overviewSectionHref,
  overviewSectionTypeFromSlug,
  sectionCanExpand,
  visibleSectionTasks,
} from './tasks';

function task(id: string, type: OverviewTask['type']): OverviewTask {
  return {
    id,
    type,
    href: `/admin/tasks/${id}`,
    details: [{ key: 'id', value: id }],
  };
}

describe('groupOverviewTasks', () => {
  it('keeps the ticket order and drops empty sections', () => {
    const sections = groupOverviewTasks([
      task('m1', 'MEMBERSHIP_REQUEST'),
      task('s1', 'SHIFT_BELOW_MINIMUM'),
      task('s2', 'SHIFT_BELOW_MINIMUM'),
      task('c1', 'CONTRACT_SIGN'),
    ]);

    expect(sections.map((section) => section.type)).toEqual([
      'MEMBERSHIP_REQUEST',
      'SHIFT_BELOW_MINIMUM',
      'CONTRACT_SIGN',
    ]);
    expect(sections[0]?.tasks).toHaveLength(2);
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
});

describe('overview section pages', () => {
  it('gives every section a stable see-all path', () => {
    for (const type of OVERVIEW_SECTION_ORDER) {
      const href = overviewSectionHref('org-1', type);
      const slug = href.split('/').at(-1) ?? '';
      expect(overviewSectionTypeFromSlug(slug)).toBe(type);
    }
    expect(overviewSectionTypeFromSlug('not-a-section')).toBeNull();
  });
});
