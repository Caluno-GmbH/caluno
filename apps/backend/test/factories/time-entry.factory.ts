import type { Database } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';

export type TimeEntry = typeof schema.timeEntries.$inferSelect;

export type CreateTimeEntryOptions = {
  organizationUnitId: string;
  volunteerId: string;
  startedAt?: Date;
  endedAt?: Date | null;
  shiftInstanceId?: string | null;
  createdById?: string | null;
};

export const createTimeEntry = async (
  db: Database,
  options: CreateTimeEntryOptions,
): Promise<TimeEntry> => {
  const [entry] = await db
    .insert(schema.timeEntries)
    .values({
      organizationUnitId: options.organizationUnitId,
      volunteerId: options.volunteerId,
      shiftInstanceId: options.shiftInstanceId ?? null,
      startedAt: options.startedAt ?? new Date(),
      endedAt: options.endedAt ?? null,
      createdById: options.createdById ?? null,
    })
    .returning();

  if (!entry) {
    throw new Error('Failed to create test time entry');
  }
  return entry;
};
