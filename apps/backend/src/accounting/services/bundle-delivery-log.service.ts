import { Inject, Injectable } from '@nestjs/common';
import { and, arrayOverlaps, desc, eq, inArray, isNotNull } from 'drizzle-orm';
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

const DELIVERED_OR_QUEUED = [
  EmailDeliveryStatus.PENDING,
  EmailDeliveryStatus.SENT,
];

export interface LatestEmailDelivery {
  occurredAt: Date;
  deliveredByUserId: string | null;
  status: EmailDeliveryStatus;
}

export interface InvoiceDeliveryRecord {
  id: string;
  method: BundleDeliveryMethod;
  occurredAt: Date;
  deliveredByUserId: string | null;
  status: EmailDeliveryStatus | null;
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

    return this.db.query.reimbursementBundleDeliveries.findMany({
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
  }

  /**
   * Whether any of the invoices already went to accounting by email, or is
   * queued to. A send whose email failed or was cancelled does not count, so
   * it can be resent without the "already sent" confirmation.
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
      .where(
        and(
          eq(deliveries.organizationUnitId, organizationUnitId),
          eq(deliveries.method, BundleDeliveryMethod.EMAIL),
          arrayOverlaps(deliveries.invoiceIds, invoiceIds),
          inArray(deliveries.emailStatus, DELIVERED_OR_QUEUED),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

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
        emailStatus: deliveries.emailStatus,
      })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.method, BundleDeliveryMethod.EMAIL),
          isNotNull(deliveries.emailStatus),
          arrayOverlaps(deliveries.invoiceIds, [...invoiceIds]),
        ),
      )
      .orderBy(desc(deliveries.occurredAt));
    const wanted = new Set(invoiceIds);
    for (const row of rows) {
      const status = row.emailStatus;
      if (!status) continue;
      for (const invoiceId of row.invoiceIds) {
        if (wanted.has(invoiceId) && !latest.has(invoiceId)) {
          latest.set(invoiceId, {
            occurredAt: row.occurredAt,
            deliveredByUserId: row.deliveredByUserId,
            status,
          });
        }
      }
    }
    return latest;
  }

  async findDeliveriesByInvoiceId(
    invoiceIds: readonly string[],
  ): Promise<Map<string, InvoiceDeliveryRecord[]>> {
    const byInvoice = new Map<string, InvoiceDeliveryRecord[]>();
    if (invoiceIds.length === 0) return byInvoice;

    const deliveries = schema.reimbursementBundleDeliveries;
    const rows = await this.db
      .select({
        id: deliveries.id,
        invoiceIds: deliveries.invoiceIds,
        method: deliveries.method,
        occurredAt: deliveries.occurredAt,
        deliveredByUserId: deliveries.deliveredByUserId,
        emailStatus: deliveries.emailStatus,
      })
      .from(deliveries)
      .where(arrayOverlaps(deliveries.invoiceIds, [...invoiceIds]))
      .orderBy(desc(deliveries.occurredAt));

    const wanted = new Set(invoiceIds);
    for (const row of rows) {
      const record: InvoiceDeliveryRecord = {
        id: row.id,
        method: row.method,
        occurredAt: row.occurredAt,
        deliveredByUserId: row.deliveredByUserId,
        status: row.emailStatus ?? null,
      };
      for (const invoiceId of row.invoiceIds) {
        if (!wanted.has(invoiceId)) continue;
        const list = byInvoice.get(invoiceId);
        if (list) {
          list.push(record);
        } else {
          byInvoice.set(invoiceId, [record]);
        }
      }
    }
    return byInvoice;
  }
}
