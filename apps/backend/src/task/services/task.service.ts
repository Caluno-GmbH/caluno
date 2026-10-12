import { Injectable } from '@nestjs/common';
import { PermissionKey } from '../../auth/enums';
import { TaskType } from '../enums/task-type.enum';
import { Task } from '../models/task.model';

/**
 * Transient task assembly. Tasks are not persisted; this stub returns
 * hardcoded placeholders until real domain computation lands.
 */
@Injectable()
export class TaskService {
  myTasks(_userId: string, organizationUnitId: string): Task[] {
    return [
      {
        id: 'stub-task-1',
        type: TaskType.SHIFT_BELOW_MINIMUM,
        link: '/admin/shifts',
        data: { shiftId: 'stub-shift-1', filledCount: 1, maxVolunteers: 4 },
        organizationUnitId,
        neededPermission: PermissionKey.SHIFT_EDIT,
      },
      {
        id: 'stub-task-2',
        type: TaskType.SHIFT_APPROVAL,
        link: '/admin/shifts/approvals',
        data: { shiftInstanceId: 'stub-instance-1', pendingCount: 2 },
        organizationUnitId,
        neededPermission: PermissionKey.SHIFT_EDIT,
      },
      {
        id: 'stub-task-3',
        type: TaskType.MEMBERSHIP_REQUEST,
        link: '/admin/volunteers/requests',
        data: { membershipRequestId: 'stub-request-1' },
        organizationUnitId,
        neededPermission: PermissionKey.VOLUNTEER_EDIT,
      },
      {
        id: 'stub-task-4',
        type: TaskType.CONTRACT_SIGN,
        link: '/documents',
        data: { contractId: 'stub-contract-1' },
        organizationUnitId,
        neededPermission: null,
      },
      {
        id: 'stub-task-5',
        type: TaskType.TIMESHEET_SIGN,
        link: '/documents/timesheets',
        data: { invoiceId: 'stub-invoice-1', month: '2026-09' },
        organizationUnitId,
        neededPermission: null,
      },
    ];
  }
}
