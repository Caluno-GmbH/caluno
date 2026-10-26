import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { AppI18nService } from '../../i18n/app-i18n.service';
import { EmailService } from '../../notification/email/email.service';
import { createEmailTemplateContext } from '../../notification/email/email-template-context';
import { timeEntryAutoClosedTemplate } from '../../notification/email/templates/time-entry-auto-closed.template';
import { NotificationService } from '../../notification/notification.service';
import { NotificationEvent } from '../../notification/notification-events';
import type { AutoClosedTimeEntry } from '../types/auto-closed-time-entry';

export interface TimeEntryAutoClosedNotifyResult {
  sent: number;
  failed: number;
}

interface EntryDetails {
  organizationUnitName: string;
  shiftTitle: string | null;
}

/**
 * Tells volunteers that the sweep checked them out. One email per entry, always
 * sent (no email setting governs it), in the volunteer's locale.
 *
 * Never throws: the entries are already closed by the time this runs, so a
 * failed mail must not undo or abort the sweep. Anything that cannot be sent —
 * a failed delivery, a volunteer without notification data (deleted user), an
 * entry whose details cannot be resolved, or a failed lookup — counts as
 * `failed`.
 */
@Injectable()
export class TimeEntryAutoClosedNotifier {
  private readonly logger = new Logger(TimeEntryAutoClosedNotifier.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly appI18n: AppI18nService,
  ) {}

  async notify(
    entries: AutoClosedTimeEntry[],
  ): Promise<TimeEntryAutoClosedNotifyResult> {
    if (entries.length === 0) return { sent: 0, failed: 0 };

    let details: Map<string, EntryDetails>;
    let recipients: Awaited<
      ReturnType<NotificationService['resolveUsersNotificationData']>
    >;
    try {
      [details, recipients] = await Promise.all([
        this.loadDetails(entries.map((entry) => entry.id)),
        this.notificationService.resolveUsersNotificationData(
          [...new Set(entries.map((entry) => entry.volunteerId))],
          { event: NotificationEvent.TIME_ENTRY_AUTO_CLOSED },
        ),
      ]);
    } catch (error) {
      this.logger.error(
        {
          event: 'time_entry_auto_closed.lookup_failed',
          entry_count: entries.length,
          err: error,
        },
        'Failed to resolve data for auto-closed time entry emails',
      );
      return { sent: 0, failed: entries.length };
    }

    const recipientsById = new Map(
      recipients.map((recipient) => [recipient.userId, recipient]),
    );

    const outcomes = await Promise.all(
      entries.map(async (entry) => {
        try {
          const recipient = recipientsById.get(entry.volunteerId);
          const detail = details.get(entry.id);
          if (!recipient || !detail) {
            this.logger.warn(
              {
                event: 'time_entry_auto_closed.unresolved',
                time_entry_id: entry.id,
                volunteer_id: entry.volunteerId,
                has_recipient: Boolean(recipient),
                has_details: Boolean(detail),
              },
              'Skipping auto-closed email: recipient or entry details not found',
            );
            return false;
          }

          const { subject, html } = await timeEntryAutoClosedTemplate(
            {
              recipientFirstName: recipient.firstName,
              organizationUnitName: detail.organizationUnitName,
              shiftTitle: detail.shiftTitle,
              startedAt: entry.startedAt,
              endedAt: entry.endedAt,
            },
            createEmailTemplateContext(this.appI18n, recipient.locale),
          );
          await this.emailService.send({
            userId: recipient.userId,
            to: recipient.email,
            subject,
            html,
          });
          return true;
        } catch (error) {
          this.logger.error(
            {
              event: 'time_entry_auto_closed.email_failed',
              time_entry_id: entry.id,
              volunteer_id: entry.volunteerId,
              err: error,
            },
            'Failed to send auto-closed time entry email',
          );
          return false;
        }
      }),
    );

    const sent = outcomes.filter(Boolean).length;
    return { sent, failed: outcomes.length - sent };
  }

  /** Org unit name and shift title for every entry, in a single query. */
  private async loadDetails(
    entryIds: string[],
  ): Promise<Map<string, EntryDetails>> {
    const rows = await this.db
      .select({
        entryId: schema.timeEntries.id,
        organizationUnitName: schema.organizationUnits.name,
        overrideTitle: schema.shiftInstances.overrideTitle,
        masterTitle: schema.shifts.title,
      })
      .from(schema.timeEntries)
      .innerJoin(
        schema.organizationUnits,
        eq(schema.organizationUnits.id, schema.timeEntries.organizationUnitId),
      )
      .leftJoin(
        schema.shiftInstances,
        eq(schema.shiftInstances.id, schema.timeEntries.shiftInstanceId),
      )
      .leftJoin(
        schema.shifts,
        eq(schema.shifts.id, schema.shiftInstances.masterId),
      )
      .where(inArray(schema.timeEntries.id, entryIds));

    return new Map(
      rows.map((row) => [
        row.entryId,
        {
          organizationUnitName: row.organizationUnitName,
          shiftTitle: row.overrideTitle ?? row.masterTitle,
        },
      ]),
    );
  }
}
