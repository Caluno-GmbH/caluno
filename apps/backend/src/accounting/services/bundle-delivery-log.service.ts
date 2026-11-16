import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  arrayOverlaps,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
} from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { EmailDeliveryStatus } from '../../notification/email/outbox/email-outbox.enums';
import { BundleDeliveryMethod } from '../enums';
import type {
  ReimbursementBundleDeliveryEntity,
  ReimbursementBundleDeliveryInsert,
} from '../schemas/reimbursement-bundle-delivery.schema';

export const MAX_DELIVERY_LOG_PAGE_SIZE = 200;

const UNDELIVERED_STATUSES = [
  EmailDeliveryStatus.FAILED,
  EmailDeliveryStatus.CANCELLED,
];

export interface LatestEmailDelivery {
  occurredAt: Date;
  deliveredByUserId: string | null;
  failed: boolean;
}
export const DEFAULT_DELIVERY_LOG_PAGE_SIZE = 50;

@Injectable()
export class BundleDeliveryLogService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async record(
    input: ReimbursementBundleDeliveryInsert,
    tx: Database = this.db,
  ): Promise<ReimbursementBundleDeliveryEntity> {
    const [row] = await tx
      .insert(schema.reimbursementBundleDeliveries)
      .values(input)
      .returning();
    if (!row) {
      throw new Error('Failed to record bundle delivery');
    }
    return row;
  }

  async list(
    organizationUnitId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_DELIVERY_LOG_PAGE_SIZE, 1),
      MAX_DELIVERY_LOG_PAGE_SIZE,
    );
    const offset = Math.max(options.offset ?? 0, 0);

    const rows = await this.db.query.reimbursementBundleDeliveries.findMany({
      where: { organizationUnitId },
      with: {
        volunteer: true,
        deliveredByUser: true,
        reimbursementType: true,
      },
      orderBy: { occurredAt: 'desc' },
      limit,
      offset,
    });

    // Only the status: the outbox row also holds the message and attachments.
    const outboxIds = rows.flatMap((row) =>
      row.emailOutboxId ? [row.emailOutboxId] : [],
    );
    const outboxRows =
      outboxIds.length > 0
        ? await this.db
            .select({
              id: schema.emailOutbox.id,
              status: schema.emailOutbox.status,
            })
            .from(schema.emailOutbox)
            .where(
              and(
                inArray(schema.emailOutbox.id, outboxIds),
                eq(schema.emailOutbox.organizationUnitId, organizationUnitId),
              ),
            )
        : [];
    const statusById = new Map(outboxRows.map((row) => [row.id, row.status]));
    return rows.map((row) => ({
      ...row,
      emailStatus: row.emailOutboxId
        ? (statusById.get(row.emailOutboxId) ?? null)
        : null,
    }));
  }

  /**
   * Whether any of the invoices already went to accounting by email. A send
   * whose email failed or was cancelled does not count, so it can be resent
   * without the "already sent" confirmation. The outbox keeps failed bundle
   * rows and purges delivered ones after 30 days, so a send whose row is gone
   * was delivered.
   */
  async hasEmailDelivery(
    organizationUnitId: string,
    invoiceIds: string[],
    tx: Database = this.db,
  ): Promise<boolean> {
    if (invoiceIds.length === 0) return false;
    const deliveries = schema.reimbursementBundleDeliveries;
    const [row] = await tx
      .select({ id: deliveries.id })
      .from(deliveries)
      .leftJoin(
        schema.emailOutbox,
        eq(schema.emailOutbox.id, deliveries.emailOutboxId),
      )
      .where(
        and(
          eq(deliveries.organizationUnitId, organizationUnitId),
          eq(deliveries.method, BundleDeliveryMethod.EMAIL),
          arrayOverlaps(deliveries.invoiceIds, invoiceIds),
          or(
            isNull(schema.emailOutbox.status),
            notInArray(schema.emailOutbox.status, UNDELIVERED_STATUSES),
          ),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /**
   * The latest email delivery of each invoice, failed ones included so the
   * board can say the send failed.
   */
  async findLatestEmailDeliveries(
    invoiceIds: readonly string[],
  ): Promise<Map<string, LatestEmailDelivery>> {
    const latest = new Map<string, LatestEmailDelivery>();
    if (invoiceIds.length === 0) return latest;

    const deliveries = schema.reimbursementBundleDeliveries;
    const rows = await this.db
      .select({
        invoiceIds: deliveries.invoiceIds,
        occurredAt: deliveries.occurredAt,
        deliveredByUserId: deliveries.deliveredByUserId,
        emailStatus: schema.emailOutbox.status,
      })
      .from(deliveries)
      .leftJoin(
        schema.emailOutbox,
        eq(schema.emailOutbox.id, deliveries.emailOutboxId),
      )
      .where(
        and(
          eq(deliveries.method, BundleDeliveryMethod.EMAIL),
          arrayOverlaps(deliveries.invoiceIds, [...invoiceIds]),
        ),
      )
      .orderBy(desc(deliveries.occurredAt));
    const wanted = new Set(invoiceIds);
    for (const row of rows) {
      const failed =
        row.emailStatus !== null &&
        UNDELIVERED_STATUSES.includes(row.emailStatus);
      for (const invoiceId of row.invoiceIds) {
        if (wanted.has(invoiceId) && !latest.has(invoiceId)) {
          latest.set(invoiceId, {
            occurredAt: row.occurredAt,
            deliveredByUserId: row.deliveredByUserId,
            failed,
          });
        }
      }
    }
    return latest;
  }
}
