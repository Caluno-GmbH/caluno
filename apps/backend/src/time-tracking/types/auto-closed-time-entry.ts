/** A time entry the auto-close sweep just closed, as handed to the notifier. */
export type AutoClosedTimeEntry = {
  id: string;
  volunteerId: string;
  organizationUnitId: string;
  shiftInstanceId: string | null;
  startedAt: Date;
  endedAt: Date;
};
