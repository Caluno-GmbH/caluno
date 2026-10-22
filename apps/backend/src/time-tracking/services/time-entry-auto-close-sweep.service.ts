import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { TimeEntryClosureKind } from '../enums';
import type { AutoClosedTimeEntry } from '../types/auto-closed-time-entry';
import { TimeEntryAutoClosedNotifier } from './time-entry-auto-closed-notifier.service';

const HOUR_MS = 3_600_000;

/** How long after its recorded end an open entry is auto-closed. */
export const CUT_OFF_MS = 24 * HOUR_MS;
/** Recorded duration of an auto-closed entry that has no shift instance. */
export const SHIFTLESS_DURATION_MS = 8 * HOUR_MS;
/**
 * Only entries whose cut-off passed within this window before the run are
 * emailed; older ones (a backlog at release, or after an outage) close
 * silently.
 */
export const EMAIL_GRACE_MS = 24 * HOUR_MS;

export interface AutoCloseSweepSummary {
  closed: number;
  emailed: number;
  email_skipped_stale: number;
  failed: number;
}

/**
 * `timestamp` columns hold UTC wall-clock time without a zone. Bind instants
 * as ISO strings cast to `timestamp` (Postgres drops the trailing `Z`), so the
 * comparison does not depend on the driver's or session's time zone.
 */
const utcTimestamp = (date: Date) => sql`${date.toISOString()}::timestamp`;

@Injectable()
export class TimeEntryAutoCloseSweepService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly notifier: TimeEntryAutoClosedNotifier,
  ) {}

  /**
   * Closes every open entry whose cut-off (recorded end + 24h) has passed, in
   * one statement, then emails the volunteers of the freshly due ones.
   *
   * Does not emit `AccountingEvent.TIME_ENTRY_CLOSED`: auto-closed hours do
   * not count until an admin reviews them.
   */
  async runTick(now: Date = new Date()): Promise<AutoCloseSweepSummary> {
    const closed = await this.closeDueEntries(now);

    const emailCutoffAfter = now.getTime() - EMAIL_GRACE_MS;
    const toNotify = closed.filter(
      (entry) => entry.endedAt.getTime() + CUT_OFF_MS > emailCutoffAfter,
    );

    const summary: AutoCloseSweepSummary = {
      closed: closed.length,
      emailed: 0,
      email_skipped_stale: closed.length - toNotify.length,
      failed: 0,
    };
    if (toNotify.length === 0) return summary;

    const { sent, failed } = await this.notifier.notify(toNotify);
    summary.emailed = sent;
    summary.failed = failed;
    return summary;
  }

  private async closeDueEntries(now: Date): Promise<AutoClosedTimeEntry[]> {
    const timeEntries = schema.timeEntries;
    const candidate = alias(schema.timeEntries, 'candidate');
    const instance = schema.shiftInstances;

    // Recorded end: the shift's current end (never before check-in), or a
    // fixed duration for shiftless entries. Read at sweep time, so a moved
    // shift moves its cut-off.
    const recordedEnd = sql<Date>`CASE
      WHEN ${candidate.shiftInstanceId} IS NULL
        THEN ${candidate.startedAt} + make_interval(secs => ${SHIFTLESS_DURATION_MS / 1000})
      ELSE GREATEST(${instance.actualEndsAt}, ${candidate.startedAt})
    END`;

    const due = this.db
      .select({
        id: candidate.id,
        recordedEnd: recordedEnd.as('recorded_end'),
      })
      .from(candidate)
      .leftJoin(instance, eq(instance.id, candidate.shiftInstanceId))
      .where(
        and(
          isNull(candidate.endedAt),
          sql`${recordedEnd} <= ${utcTimestamp(new Date(now.getTime() - CUT_OFF_MS))}`,
        ),
      )
      .as('due');

    const rows = await this.db
      .update(timeEntries)
      .set({
        endedAt: sql`${due.recordedEnd}`,
        closureKind: TimeEntryClosureKind.AUTO,
      })
      .from(due)
      .where(
        and(
          eq(timeEntries.id, due.id),
          // Re-checked against the latest row version when a concurrent
          // check-out holds the row: the human close wins and is not
          // overwritten.
          isNull(timeEntries.endedAt),
        ),
      )
      .returning({
        id: timeEntries.id,
        volunteerId: timeEntries.volunteerId,
        organizationUnitId: timeEntries.organizationUnitId,
        shiftInstanceId: timeEntries.shiftInstanceId,
        startedAt: timeEntries.startedAt,
        endedAt: timeEntries.endedAt,
      });

    return rows.map(({ endedAt, ...entry }) => {
      if (!endedAt) {
        throw new Error(`Auto-closed time entry ${entry.id} has no end`);
      }
      return { ...entry, endedAt };
    });
  }
}
