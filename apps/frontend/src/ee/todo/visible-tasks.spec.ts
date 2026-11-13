import { describe, expect, it } from 'bun:test';
import { PermissionKey, TaskType } from '@repo/data';
import type { OverviewSourceTask } from './visible-tasks';
import { visibleOverviewTasks } from './visible-tasks';

const ORG = 'org-1';

function source(
  overrides: Partial<OverviewSourceTask> &
    Pick<OverviewSourceTask, 'id' | 'type'>,
): OverviewSourceTask {
  return {
    link: '/admin/target',
    data: {},
    organizationUnitId: ORG,
    neededPermission: null,
    ...overrides,
  };
}

const options = {
  organizationUnitId: ORG,
  permissions: [PermissionKey.ShiftEdit, PermissionKey.VolunteerEdit],
};

describe('visibleOverviewTasks', () => {
  it('keeps the selected unit and drops actions the admin cannot do', () => {
    const tasks = visibleOverviewTasks(
      [
        source({
          id: 'here',
          type: TaskType.ShiftBelowMinimum,
          neededPermission: PermissionKey.ShiftEdit,
        }),
        source({
          id: 'other-unit',
          type: TaskType.ShiftBelowMinimum,
          organizationUnitId: 'org-2',
          neededPermission: PermissionKey.ShiftEdit,
        }),
        source({
          id: 'no-permission',
          type: TaskType.MembershipRequest,
          neededPermission: PermissionKey.VolunteerEdit,
        }),
      ],
      { organizationUnitId: ORG, permissions: [PermissionKey.ShiftEdit] },
    );

    expect(tasks.map((task) => task.id)).toEqual(['here']);
  });

  it('skips contracts expiring soon', () => {
    const tasks = visibleOverviewTasks(
      [
        source({ id: 'expiring', type: TaskType.ContractExpiring }),
        source({ id: 'sign', type: TaskType.ContractSign }),
      ],
      options,
    );

    expect(tasks.map((task) => task.id)).toEqual(['sign']);
  });

  it('drops org-declined documents and rows a replacement already covers', () => {
    const tasks = visibleOverviewTasks(
      [
        source({
          id: 'volunteer',
          type: TaskType.DocumentDeclined,
          data: { declinedAtSigneeType: 'VOLUNTEER' },
        }),
        source({
          id: 'org',
          type: TaskType.DocumentDeclined,
          data: { declinedAtSigneeType: 'PERMISSION_HOLDER' },
        }),
        source({
          id: 'replaced',
          type: TaskType.DocumentDeclined,
          data: {
            declinedAtSigneeType: 'VOLUNTEER',
            hasReplacement: true,
          },
        }),
      ],
      options,
    );

    expect(tasks.map((task) => task.id)).toEqual(['volunteer']);
  });
});
