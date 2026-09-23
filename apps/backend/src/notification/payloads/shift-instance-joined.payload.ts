export interface ShiftInstanceJoinedPayload {
  organizationUnitId: string;
  organizationUnitName: string;
  shiftId: string;
  shiftTitle: string;
  instanceId: string;
  joinedUserId: string;
  recipientUserIds: string[];
  startsAt: Date;
}
