import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { NotificationService } from '../../notification/notification.service';
import { TermsChangeClass } from '../enums';

const BATCH_SIZE = 200;

@Injectable()
export class TermsNotificationService {
  private readonly logger = new Logger(TermsNotificationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly notificationService: NotificationService,
  ) {}

  async broadcastForVersion(input: {
    version: string;
    class: TermsChangeClass;
    acceptTermsUrl: string;
  }): Promise<number> {
    // Recovery may re-run a version whose send was interrupted. Skip anyone who
    // already has a `terms_notifications` row for this version so re-runs only
    // email the users who were never reached.
    const alreadyNotified = new Set(
      (
        await this.db
          .select({ userId: schema.termsNotifications.userId })
          .from(schema.termsNotifications)
          .where(eq(schema.termsNotifications.version, input.version))
      ).map((row) => row.userId),
    );

    let offset = 0;
    let sent = 0;

    for (;;) {
      const users = await this.db.query.users.findMany({
        orderBy: { id: 'asc' },
        limit: BATCH_SIZE,
        offset,
        columns: { id: true },
      });
      if (users.length === 0) {
        break;
      }

      const userIds = users
        .map((user) => user.id)
        .filter((userId) => !alreadyNotified.has(userId));
      if (userIds.length === 0) {
        offset += BATCH_SIZE;
        continue;
      }

      await this.notificationService.notifyTermsUpdatedAsync({
        class: input.class,
        acceptTermsUrl: input.acceptTermsUrl,
        recipientUserIds: userIds,
      });

      await this.db.insert(schema.termsNotifications).values(
        userIds.map((userId) => ({
          userId,
          version: input.version,
          class: input.class,
          channel: 'email',
        })),
      );

      sent += userIds.length;
      offset += BATCH_SIZE;
    }

    this.logger.log(
      `terms broadcast for ${input.version}: ${sent} users notified`,
    );
    return sent;
  }
}
