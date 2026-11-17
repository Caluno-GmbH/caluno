import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
  NotFoundGraphQLError,
  UnprocessableEntityGraphQLError,
} from '../../graphql/errors';
import type { Locale } from '../../graphql/locale';
import { AppI18nService } from '../../i18n/app-i18n.service';
import { createEmailTemplateContext } from '../../notification/email/email-template-context';
import {
  EmailCategory,
  EmailDeliveryStatus,
} from '../../notification/email/outbox/email-outbox.enums';
import {
  EmailOutboxService,
  type SettledEmailStatus,
} from '../../notification/email/outbox/email-outbox.service';
import { accountingBundleTemplate } from '../../notification/email/templates/accounting-bundle.template';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import { MAX_NAMED_INVOICES } from '../dto/download-bundle-query.dto';
import { BundleDeliveryIssue, BundleDeliveryMethod } from '../enums';
import type { ReimbursementBundleDeliveryEntity } from '../schemas/reimbursement-bundle-delivery.schema';
import {
  formatBundlePeriod,
  renderBundleSubject,
} from '../utils/bundle-email-subject';
import { AccountingDeliverySettingsService } from './accounting-delivery-settings.service';
import { BundleDeliveryLogService } from './bundle-delivery-log.service';
import {
  type BundleDocument,
  BundleDownloadService,
  type BundleScope,
  type ReadyInvoice,
} from './bundle-download.service';
import { ReimbursementRateService } from './reimbursement-rate.service';

/**
 * Production sends through the Scaleway TEM API, which takes at most 10
 * attachments and 2 MB per message, attachments (base64) included. The cap
 * leaves room for the HTML and text bodies.
 */
export const MAX_BUNDLE_EMAIL_ATTACHMENTS = 10;
export const MAX_BUNDLE_EMAIL_BYTES = 1_800_000;

const ISSUE_COPY_KEY: Record<BundleDeliveryIssue, string> = {
  [BundleDeliveryIssue.NO_CONTRACT]: 'accountingBundle.issueNoContract',
  [BundleDeliveryIssue.OVER_LIMIT]: 'accountingBundle.issueOverLimit',
  [BundleDeliveryIssue.ALREADY_SENT]: 'accountingBundle.issueAlreadySent',
};

interface SendRequest {
  organizationId: string;
  scope: BundleScope;
  invoiceIds: string[] | undefined;
  sender: { id: string; name: string };
  locale: Locale;
}

export interface BundleSendPreview {
  issues: BundleDeliveryIssue[];
  recipientEmail: string | null;
  subject: string;
  documentCount: number;
  fitsInEmail: boolean;
}

/**
 * Sends a volunteer's ready bundle (one reimbursement type) to the unit's
 * accounting address as one email, one PDF per timesheet. Faulty bundles
 * go out only when the sender confirmed each issue the server finds.
 */
@Injectable()
export class BundleEmailService implements OnModuleInit {
  private readonly logger = new Logger(BundleEmailService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly bundleDownloadService: BundleDownloadService,
    private readonly deliverySettingsService: AccountingDeliverySettingsService,
    private readonly bundleDeliveryLogService: BundleDeliveryLogService,
    private readonly reimbursementRateService: ReimbursementRateService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly emailOutbox: EmailOutboxService,
    private readonly appI18n: AppI18nService,
  ) {}

  onModuleInit(): void {
    this.emailOutbox.onEmailSettled(
      EmailCategory.ACCOUNTING_BUNDLE,
      (tx, settled) => this.settle(tx, settled.emailId, settled.status),
    );
  }

  async preview(request: SendRequest): Promise<BundleSendPreview> {
    const { invoices, settings, issues, subject } = await this.prepare(request);
    return {
      issues,
      recipientEmail: settings.recipientEmail ?? null,
      subject,
      documentCount: invoices.length,
      fitsInEmail: invoices.length <= MAX_BUNDLE_EMAIL_ATTACHMENTS,
    };
  }

  async send(
    request: SendRequest & {
      acknowledgedIssues: BundleDeliveryIssue[];
      expectedRecipientEmail: string;
      expectedSubject: string;
    },
  ): Promise<ReimbursementBundleDeliveryEntity> {
    const {
      invoices,
      settings,
      issues,
      subject,
      volunteerName,
      periodLabel,
      reimbursementTypeLabel,
    } = await this.prepare(request);
    const recipientEmail = settings.recipientEmail;
    if (settings.deliveryMethod !== BundleDeliveryMethod.EMAIL) {
      throw new BadRequestGraphQLError(
        'This unit does not send bundles by email',
      );
    }
    if (!recipientEmail) {
      throw new BadRequestGraphQLError(
        'No accounting email address is configured for this unit',
      );
    }
    // The admin confirmed the address and subject the preview showed; a
    // settings change since must not redirect the documents unseen.
    if (
      recipientEmail !== request.expectedRecipientEmail ||
      subject !== request.expectedSubject
    ) {
      throw new ConflictGraphQLError(
        'The accounting address or subject changed since the preview',
      );
    }
    // The client asks only for the issues it showed; anything new since
    // (e.g. another admin sent the bundle meanwhile) needs a new confirmation.
    if (issues.some((issue) => !request.acknowledgedIssues.includes(issue))) {
      throw new ConflictGraphQLError(
        'The bundle has issues that were not confirmed',
      );
    }
    if (invoices.length > MAX_BUNDLE_EMAIL_ATTACHMENTS) {
      throw new UnprocessableEntityGraphQLError(
        'The bundle has too many documents to send by email',
      );
    }

    const { scope, sender, locale } = request;
    const documents = await this.bundleDownloadService.assembleDocuments(
      invoices,
      scope,
      sender.id,
    );
    const context = createEmailTemplateContext(this.appI18n, locale);
    const unit = await this.organizationUnitDataService.findById(
      scope.organizationUnitId,
    );
    const { html } = await accountingBundleTemplate(
      {
        subject,
        volunteerName,
        periodLabel,
        reimbursementTypeLabel,
        organizationUnitName: unit?.name ?? '',
        senderName: sender.name,
        documentCount: documents.length,
        confirmedIssues: issues.map((issue) =>
          context.t(ISSUE_COPY_KEY[issue]),
        ),
      },
      context,
    );
    if (encodedSize(documents, html) > MAX_BUNDLE_EMAIL_BYTES) {
      throw new UnprocessableEntityGraphQLError(
        'The bundle is too large to send by email',
      );
    }

    // Queued and logged together. The invoices are marked paid only once the
    // outbox reports the email sent (see `settle`).
    return this.db.transaction(async (tx) => {
      // The "already sent" check above ran outside this transaction. Two
      // sends of the same bundle at once would both pass it, so they queue
      // here and the second one sees the first one's delivery.
      await tx.execute(
        sql`select pg_advisory_xact_lock(${ADVISORY_LOCK_KEYS.accountingBundleSend}, hashtext(${`${scope.volunteerId}:${scope.reimbursementTypeId}`}))`,
      );
      if (
        !issues.includes(BundleDeliveryIssue.ALREADY_SENT) &&
        (await this.bundleDeliveryLogService.hasEmailDelivery(
          scope.organizationUnitId,
          invoices.map((invoice) => invoice.id),
          tx,
        ))
      ) {
        throw new ConflictGraphQLError(
          'The bundle has issues that were not confirmed',
        );
      }
      const email = await this.emailOutbox.enqueue(
        {
          category: EmailCategory.ACCOUNTING_BUNDLE,
          to: recipientEmail,
          subject,
          html,
          attachments: documents.map((document) => ({
            filename: document.filename,
            content: document.content,
            contentType: 'application/pdf',
          })),
          organizationUnitId: scope.organizationUnitId,
          // A timed-out send may still have reached the provider; a retry
          // could hand accounting the same documents twice. A failure shows
          // on the board instead, and the admin resends.
          maxAttempts: 1,
        },
        tx,
      );
      return this.bundleDeliveryLogService.record(
        {
          ...scope,
          method: BundleDeliveryMethod.EMAIL,
          invoiceIds: invoices.map((invoice) => invoice.id),
          recipientEmail,
          subject,
          issues,
          emailOutboxId: email.id,
          emailStatus: EmailDeliveryStatus.PENDING,
          deliveredByUserId: sender.id,
        },
        tx,
      );
    });
  }

  private async settle(
    tx: Database,
    emailId: string,
    status: SettledEmailStatus,
  ): Promise<void> {
    const [delivery] = await tx
      .update(schema.reimbursementBundleDeliveries)
      .set({ emailStatus: status })
      .where(eq(schema.reimbursementBundleDeliveries.emailOutboxId, emailId))
      .returning();
    if (!delivery || status !== EmailDeliveryStatus.SENT) return;
    try {
      // A savepoint: the log must say the email went out even if the paid
      // stamp fails, or the board would show the bundle as sending forever.
      await tx.transaction((savepoint) =>
        this.reimbursementRateService.markInvoicesPaid(
          savepoint,
          delivery.volunteerId,
          delivery.reimbursementTypeId,
          delivery.deliveredByUserId,
          delivery.invoiceIds,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Bundle delivery ${delivery.id} was sent but its invoices could not be marked paid: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async prepare(request: SendRequest) {
    const { organizationId, scope, locale } = request;
    if ((request.invoiceIds?.length ?? 0) > MAX_NAMED_INVOICES) {
      throw new BadRequestGraphQLError('Too many timesheets named');
    }
    const invoices: ReadyInvoice[] =
      await this.bundleDownloadService.loadReadyInvoices(
        scope,
        request.invoiceIds,
      );
    if (invoices.length === 0) {
      throw new BadRequestGraphQLError(
        'No ready documents to send for this volunteer and reimbursement type',
      );
    }

    const [settings, issues, volunteer, reimbursementType] = await Promise.all([
      this.deliverySettingsService.resolve(scope.organizationUnitId, locale),
      this.bundleDownloadService.findIssues(organizationId, scope, invoices, {
        checkAlreadySent: true,
      }),
      this.db.query.users.findFirst({
        where: { id: scope.volunteerId },
        columns: { name: true },
      }),
      this.reimbursementRateService.findReimbursementTypeById(
        scope.reimbursementTypeId,
      ),
    ]);
    if (!volunteer) throw new NotFoundGraphQLError('Volunteer not found');

    const { t } = createEmailTemplateContext(this.appI18n, locale);
    const periodLabel = formatBundlePeriod(
      invoices.map((invoice) => invoice.periodStart),
      locale,
    );
    const typeLabel = t(`accountingBundle.type${reimbursementType.key}`);
    const subject = renderBundleSubject(settings.emailSubject, {
      volunteer: volunteer.name,
      period: periodLabel,
      type: typeLabel,
    });
    return {
      invoices,
      settings,
      issues,
      subject,
      volunteerName: volunteer.name,
      periodLabel,
      reimbursementTypeLabel: typeLabel,
    };
  }
}

/** What the message weighs on the wire: base64 attachments plus both bodies. */
function encodedSize(documents: BundleDocument[], html: string): number {
  const attachments = documents.reduce(
    (sum, document) => sum + Math.ceil(document.content.length / 3) * 4,
    0,
  );
  // The text body is derived from the HTML and is never longer.
  return attachments + 2 * Buffer.byteLength(html);
}
