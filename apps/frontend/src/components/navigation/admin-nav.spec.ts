import { describe, expect, it } from 'bun:test';
import { PermissionKey } from '@repo/data';
import type { EeNavContribution } from '@/edition/enterprise-extensions';
import {
  ADMIN_NAV_ITEM,
  ADMIN_NAV_SECTION,
  buildAdminNav,
  insertBefore,
  mergeAdminNav,
  visibleAdminNav,
} from './admin-nav';

const baseCtx = {
  orgUId: 'org-1',
  accountingEnabled: true,
  permissionSet: new Set([PermissionKey.OrgView]),
};

describe('insertBefore', () => {
  it('appends when before is omitted', () => {
    expect(insertBefore([{ id: 'a' }, { id: 'b' }], { id: 'c' })).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
  });

  it('inserts before a known id', () => {
    expect(insertBefore([{ id: 'a' }, { id: 'b' }], { id: 'x' }, 'b')).toEqual([
      { id: 'a' },
      { id: 'x' },
      { id: 'b' },
    ]);
  });

  it('appends when before id is unknown', () => {
    expect(insertBefore([{ id: 'a' }], { id: 'x' }, 'missing')).toEqual([
      { id: 'a' },
      { id: 'x' },
    ]);
  });
});

describe('buildAdminNav', () => {
  it('emits stable section and item ids without todo', () => {
    const sections = buildAdminNav(baseCtx);
    expect(sections.map((s) => s.id)).toEqual([
      ADMIN_NAV_SECTION.menu,
      ADMIN_NAV_SECTION.accounting,
      ADMIN_NAV_SECTION.settings,
      ADMIN_NAV_SECTION.shortcuts,
    ]);
    expect(sections[0]?.items.map((i) => i.id)).toEqual([
      ADMIN_NAV_ITEM.events,
      ADMIN_NAV_ITEM.shifts,
      ADMIN_NAV_ITEM.timesheets,
      ADMIN_NAV_ITEM.volunteers,
      ADMIN_NAV_ITEM.requirementForms,
    ]);
  });

  it('always includes accounting and settings for stable anchors', () => {
    const sections = buildAdminNav({
      ...baseCtx,
      accountingEnabled: false,
      permissionSet: new Set(),
    });
    expect(sections.map((s) => s.id)).toEqual([
      ADMIN_NAV_SECTION.menu,
      ADMIN_NAV_SECTION.accounting,
      ADMIN_NAV_SECTION.settings,
      ADMIN_NAV_SECTION.shortcuts,
    ]);
  });
});

describe('visibleAdminNav', () => {
  it('keeps sections/items without show', () => {
    const visible = visibleAdminNav(buildAdminNav(baseCtx));
    expect(visible.map((s) => s.id)).toEqual([
      ADMIN_NAV_SECTION.menu,
      ADMIN_NAV_SECTION.settings,
      ADMIN_NAV_SECTION.shortcuts,
    ]);
  });

  it('hides accounting when accountingEnabled is false', () => {
    const visible = visibleAdminNav(
      buildAdminNav({ ...baseCtx, accountingEnabled: false }),
    );
    expect(visible.map((s) => s.id)).not.toContain(
      ADMIN_NAV_SECTION.accounting,
    );
  });

  it('hides settings without OrgView', () => {
    const visible = visibleAdminNav(
      buildAdminNav({ ...baseCtx, permissionSet: new Set() }),
    );
    expect(visible.map((s) => s.id)).not.toContain(ADMIN_NAV_SECTION.settings);
  });

  it('hides items whose show returns false', () => {
    const sections = buildAdminNav(baseCtx);
    const menu = sections.find((s) => s.id === ADMIN_NAV_SECTION.menu);
    if (!menu) throw new Error('menu missing');
    menu.items = menu.items.map((item) =>
      item.id === ADMIN_NAV_ITEM.events ? { ...item, show: () => false } : item,
    );
    const visibleMenu = visibleAdminNav(sections).find(
      (s) => s.id === ADMIN_NAV_SECTION.menu,
    );
    expect(visibleMenu?.items.map((i) => i.id)).not.toContain(
      ADMIN_NAV_ITEM.events,
    );
  });
});

describe('mergeAdminNav', () => {
  const base = buildAdminNav(baseCtx);

  it('is a no-op for empty contributions', () => {
    expect(mergeAdminNav(base, undefined)).toEqual([...base]);
    expect(mergeAdminNav(base, [])).toEqual([...base]);
  });

  it('appends an item when before is omitted and keeps href as-is', () => {
    const contributions: EeNavContribution[] = [
      {
        kind: 'item',
        id: 'my-note',
        section: ADMIN_NAV_SECTION.menu,
        titleKey: 'myNote',
        href: '/admin/org-1/my-note',
        icon: 'list-todo',
      },
    ];
    const merged = mergeAdminNav(base, contributions);
    const menu = merged.find((s) => s.id === ADMIN_NAV_SECTION.menu);
    expect(menu?.items.at(-1)?.id).toBe('my-note');
    expect(menu?.items.at(-1)?.href).toBe('/admin/org-1/my-note');
  });

  it('inserts an item before a known anchor', () => {
    const contributions: EeNavContribution[] = [
      {
        kind: 'item',
        id: 'my-note',
        section: ADMIN_NAV_SECTION.menu,
        before: ADMIN_NAV_ITEM.volunteers,
        titleKey: 'myNote',
        href: '/admin/org-1/my-note',
        icon: 'list-todo',
      },
    ];
    const menu = mergeAdminNav(base, contributions).find(
      (s) => s.id === ADMIN_NAV_SECTION.menu,
    );
    const ids = menu?.items.map((i) => i.id) ?? [];
    expect(ids.indexOf('my-note')).toBe(
      ids.indexOf(ADMIN_NAV_ITEM.volunteers) - 1,
    );
  });

  it('resolves countBadge via the client registry when provided', () => {
    // biome-ignore lint/correctness/noComponentHookFactories: ok in a test
    const CountBadge = () => null;
    const contributions: EeNavContribution[] = [
      {
        kind: 'item',
        id: ADMIN_NAV_ITEM.todo,
        section: ADMIN_NAV_SECTION.menu,
        before: ADMIN_NAV_ITEM.events,
        titleKey: 'todo',
        href: '/admin/org-1',
        icon: 'list-todo',
        countBadge: 'todo',
      },
    ];
    const withoutRegistry = mergeAdminNav(base, contributions).find(
      (s) => s.id === ADMIN_NAV_SECTION.menu,
    );
    expect(
      withoutRegistry?.items.find((i) => i.id === ADMIN_NAV_ITEM.todo)
        ?.CountBadge,
    ).toBeUndefined();

    const withRegistry = mergeAdminNav(base, contributions, {
      todo: CountBadge,
    }).find((s) => s.id === ADMIN_NAV_SECTION.menu);
    expect(
      withRegistry?.items.find((i) => i.id === ADMIN_NAV_ITEM.todo)?.CountBadge,
    ).toBe(CountBadge);
  });

  it('appends an item when before anchor is unknown', () => {
    const contributions: EeNavContribution[] = [
      {
        kind: 'item',
        id: 'my-note',
        section: ADMIN_NAV_SECTION.menu,
        before: 'does-not-exist',
        titleKey: 'myNote',
        href: '/admin/org-1/my-note',
        icon: 'list-todo',
      },
    ];
    const menu = mergeAdminNav(base, contributions).find(
      (s) => s.id === ADMIN_NAV_SECTION.menu,
    );
    expect(menu?.items.at(-1)?.id).toBe('my-note');
  });

  it('inserts a new section before an existing one', () => {
    const contributions: EeNavContribution[] = [
      {
        kind: 'section',
        id: 'reports',
        labelKey: 'reports',
        before: ADMIN_NAV_SECTION.settings,
        items: [
          {
            id: 'reports-overview',
            titleKey: 'reportsOverview',
            href: '/reports',
            icon: 'list-todo',
          },
        ],
      },
    ];
    const ids = mergeAdminNav(base, contributions).map((s) => s.id);
    expect(ids.indexOf('reports')).toBe(
      ids.indexOf(ADMIN_NAV_SECTION.settings) - 1,
    );
  });

  it('appends a new section when before is omitted', () => {
    const contributions: EeNavContribution[] = [
      {
        kind: 'section',
        id: 'reports',
        labelKey: 'reports',
        items: [],
      },
    ];
    const ids = mergeAdminNav(base, contributions).map((s) => s.id);
    expect(ids.at(-1)).toBe('reports');
  });
});

describe('volunteers CountBadge', () => {
  it('attaches VolunteersNavCountBadge on the volunteers item', () => {
    const volunteers = buildAdminNav(baseCtx)[0]?.items.find(
      (i) => i.id === ADMIN_NAV_ITEM.volunteers,
    );
    if (!volunteers) throw new Error('volunteers missing');
    expect(volunteers.CountBadge).toBeTruthy();
  });
});
