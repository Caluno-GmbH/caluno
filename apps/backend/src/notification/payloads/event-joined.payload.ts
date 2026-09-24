export interface EventJoinedPayload {
  organizationUnitId: string;
  organizationUnitName: string;
  eventId: string;
  eventTitle: string;
  joinedUserId: string;
  recipientUserIds: string[];
  startsAt: Date;
}
