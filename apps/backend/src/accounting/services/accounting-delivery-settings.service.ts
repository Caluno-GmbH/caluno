import { Inject, Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { BadRequestGraphQLError } from '../../graphql/errors';
import type { Locale } from '../../graphql/locale';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import { isBlank } from '../../utils';
import { AccountingSettingSourceKind, BundleDeliveryMethod } from '../enums';
import type { UpdateAccountingDeliverySettingsInput } from '../inputs';
import type {
  AccountingDeliverySettings,
  AccountingSettingSource,
} from '../models/accounting-delivery-settings.model';
import type { AccountingDeliverySettingEntity } from '../schemas/accounting-delivery-setting.schema';
import {
  DEFAULT_BUNDLE_SUBJECT,
  MAX_BUNDLE_SUBJECT_LENGTH,
  unknownSubjectPlaceholders,
} from '../utils/bundle-email-subject';

type SettingField = 'deliveryMethod' | 'recipientEmail' | 'emailSubject';

interface ResolvedField<T> {
  value: T | null;
  source: AccountingSettingSource;
}

@Injectable()
export class AccountingDeliverySettingsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
  ) {}

  async resolve(
    organizationUnitId: string,
    locale: Locale,
  ): Promise<AccountingDeliverySettings> {
    const chain =
      await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
        organizationUnitId,
      );
    const [rows, units] = await Promise.all([
      this.db.query.accountingDeliverySettings.findMany({
        where: { organizationUnitId: { in: chain } },
      }),
      this.organizationUnitDataService.findByIds(chain),
    ]);
    const rowByUnit = new Map(rows.map((row) => [row.organizationUnitId, row]));
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
    const own = rowByUnit.get(organizationUnitId);

    const resolveField = <K extends SettingField>(
      field: K,
      links: string[] = chain,
    ): ResolvedField<NonNullable<AccountingDeliverySettingEntity[K]>> => {
      for (const unitId of links) {
        const value = rowByUnit.get(unitId)?.[field];
        if (value !== null && value !== undefined) {
          return {
            value: value as NonNullable<AccountingDeliverySettingEntity[K]>,
            source:
              unitId === organizationUnitId
                ? { kind: AccountingSettingSourceKind.OWN, sourceName: null }
                : {
                    kind: AccountingSettingSourceKind.INHERITED,
                    sourceName: unitNames.get(unitId) ?? null,
                  },
          };
        }
      }
      return {
        value: null,
        source: { kind: AccountingSettingSourceKind.DEFAULT, sourceName: null },
      };
    };

    const deliveryMethod = resolveField('deliveryMethod');
    const recipientEmail = resolveField('recipientEmail');
    const emailSubject = resolveField('emailSubject');
    const defaultEmailSubject = DEFAULT_BUNDLE_SUBJECT[locale];
    // The chain starts at the unit itself; without it, what the unit would
    // fall back to if it cleared its own values.
    const parentChain = chain.slice(1);

    return {
      deliveryMethod: deliveryMethod.value ?? BundleDeliveryMethod.DOWNLOAD,
      deliveryMethodSource: deliveryMethod.source,
      recipientEmail: recipientEmail.value,
      recipientEmailSource: recipientEmail.source,
      emailSubject: emailSubject.value ?? defaultEmailSubject,
      emailSubjectSource: emailSubject.source,
      ownDeliveryMethod: own?.deliveryMethod ?? null,
      ownRecipientEmail: own?.recipientEmail ?? null,
      ownEmailSubject: own?.emailSubject ?? null,
      inheritedDeliveryMethod:
        resolveField('deliveryMethod', parentChain).value ??
        BundleDeliveryMethod.DOWNLOAD,
      inheritedRecipientEmail: resolveField('recipientEmail', parentChain)
        .value,
      inheritedEmailSubject:
        resolveField('emailSubject', parentChain).value ?? defaultEmailSubject,
      defaultEmailSubject,
    };
  }

  async update(
    organizationUnitId: string,
    input: UpdateAccountingDeliverySettingsInput,
    userId: string,
    locale: Locale = 'de',
  ): Promise<AccountingDeliverySettings> {
    const organizationId =
      await this.organizationUnitDataService.findOrganizationIdByUnitId(
        organizationUnitId,
      );

    const values: Partial<Record<SettingField, string | null>> = {};
    if (input.deliveryMethod !== undefined) {
      values.deliveryMethod = input.deliveryMethod;
    }
    if (input.recipientEmail !== undefined) {
      const recipient = isBlank(input.recipientEmail)
        ? null
        : (input.recipientEmail?.trim() ?? null);
      // GraphQL inputs are not run through a ValidationPipe, so the input's
      // decorators document the rule and this enforces it.
      if (recipient && (!isEmail(recipient) || recipient.length > 254)) {
        throw new BadRequestGraphQLError(
          'The recipient is not an email address',
        );
      }
      values.recipientEmail = recipient;
    }
    if (
      input.deliveryMethod != null &&
      !Object.values(BundleDeliveryMethod).includes(input.deliveryMethod)
    ) {
      throw new BadRequestGraphQLError('Unknown delivery method');
    }
    if (input.emailSubject !== undefined) {
      const subject = isBlank(input.emailSubject)
        ? null
        : (input.emailSubject?.trim() ?? null);
      if (subject && subject.length > MAX_BUNDLE_SUBJECT_LENGTH) {
        throw new BadRequestGraphQLError('The subject is too long');
      }
      if (subject && unknownSubjectPlaceholders(subject).length > 0) {
        throw new BadRequestGraphQLError(
          'The subject contains an unknown placeholder',
        );
      }
      values.emailSubject = subject;
    }

    // Email without an address resolving anywhere up the chain is refused for
    // the unit being edited. A descendant can still end up there when an
    // ancestor's address is cleared; the board then falls back to download.
    const current = await this.resolve(organizationUnitId, locale);
    const method =
      values.deliveryMethod === undefined
        ? current.deliveryMethod
        : (values.deliveryMethod ?? current.inheritedDeliveryMethod);
    const recipient =
      values.recipientEmail === undefined
        ? current.recipientEmail
        : (values.recipientEmail ?? current.inheritedRecipientEmail);
    if (method === BundleDeliveryMethod.EMAIL && !recipient) {
      throw new BadRequestGraphQLError(
        'Sending by email needs an accounting email address',
      );
    }

    const set = {
      ...(values as Partial<AccountingDeliverySettingEntity>),
      updatedByUserId: userId,
    };
    await this.db
      .insert(schema.accountingDeliverySettings)
      .values({ organizationId, organizationUnitId, ...set })
      .onConflictDoUpdate({
        target: schema.accountingDeliverySettings.organizationUnitId,
        set: { ...set, updatedAt: new Date() },
      });
    return this.resolve(organizationUnitId, locale);
  }
}
