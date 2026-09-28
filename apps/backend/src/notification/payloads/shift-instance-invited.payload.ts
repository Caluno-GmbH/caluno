import type { ReimbursementTypeKey } from '../../accounting/enums';

export interface ShiftInstanceInvitedPayload {
  organizationUnitId: string;
  organizationUnitName: string;
  shiftId: string;
  shiftTitle: string;
  shiftLocation?: string | null;
  shiftInstructions?: string | null;
  recipientUserIds: string[];
  startsAt: Date;
  endsAt: Date;
  instanceId: string;
  reimbursementTypeKey?: ReimbursementTypeKey | null;
}
