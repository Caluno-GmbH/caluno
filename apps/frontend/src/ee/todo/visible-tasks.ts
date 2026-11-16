import { type MyTasksQuery, type PermissionKey, TaskType } from '@repo/data';
import { isOverviewTaskType } from './tasks';

export type OverviewSourceTask = MyTasksQuery['myTasks'][number];

/**
 * The selected sidebar unit, and only actions this admin can do.
 * Contracts expiring soon are not an admin action. Org-declined documents
 * and rows the query marks as already replaced stay off the list.
 */
export function visibleOverviewTasks(
  tasks: OverviewSourceTask[],
  options: {
    organizationUnitId: string;
    permissions: ReadonlySet<PermissionKey> | readonly PermissionKey[];
  },
): OverviewSourceTask[] {
  const permissions =
    options.permissions instanceof Set
      ? options.permissions
      : new Set(options.permissions);

  return tasks.filter((task) => {
    if (task.type === TaskType.ContractExpiring) return false;
    if (!isOverviewTaskType(task.type)) return false;
    if (task.organizationUnitId !== options.organizationUnitId) return false;
    if (task.neededPermission && !permissions.has(task.neededPermission)) {
      return false;
    }
    if (
      task.type === TaskType.DocumentDeclined &&
      !isVolunteerDeclined(task.data)
    ) {
      return false;
    }
    if (task.data.hasReplacement === true) return false;
    return true;
  });
}

function isVolunteerDeclined(data: Record<string, unknown>): boolean {
  const role = data.declinedAtSigneeType;
  if (typeof role !== 'string') return true;
  return role.toUpperCase() === 'VOLUNTEER';
}
