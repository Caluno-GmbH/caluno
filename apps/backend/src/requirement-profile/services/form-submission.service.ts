import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
  ForbiddenGraphQLError,
  NotFoundGraphQLError,
} from '../../graphql/errors';
import type { PaginationInput } from '../../graphql/pagination.input';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
  type PostHogSurface,
} from '../../shared/observability/posthog.events';
import { PostHogService } from '../../shared/observability/posthog.service';
import { UserService } from '../../user/user.service';
import { SYSTEM_PROFILE_KEYS } from '../constants';
import { FieldType, RequiredFormTargetType } from '../enums';
import { SubmitFormInput } from '../inputs/submit-form.input';
import { validateSystemKeyValue } from '../profile-validation';
import type { FormSubmissionEntity } from '../schemas/form-submission.schema';
import { isUnitInOrg } from './is-unit-in-org';
import { parseMultiChoiceValue } from './multi-choice-value';
import {
  RequiredFormService,
  type RequiredFormTarget,
} from './required-form.service';

@Injectable()
export class FormSubmissionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly userService: UserService,
    private readonly requiredFormService: RequiredFormService,
    private readonly postHogService: PostHogService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
  ) {}

  async findById(id: string): Promise<FormSubmissionEntity | undefined> {
    return this.db.query.formSubmissions.findFirst({
      where: { id },
      with: { values: true },
    });
  }

  async findByFormId(
    formId: string,
    pagination: PaginationInput,
  ): Promise<{ items: FormSubmissionEntity[]; total: number }> {
    const items = await this.db.query.formSubmissions.findMany({
      where: { formId },
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { submittedAt: 'desc' },
      with: { values: true, user: true },
    });
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.formId, formId));
    return { items, total };
  }

  async findByUserFormAndOrgUnit(
    userId: string,
    formId: string,
    organizationUnitId: string,
  ): Promise<FormSubmissionEntity | undefined> {
    return this.db.query.formSubmissions.findFirst({
      where: {
        userId,
        formId,
        organizationUnitId,
      },
      with: { values: true },
    });
  }

  /** Stored field values anchored on the user's OrganizationUserProfile (latest per field). */
  async findStoredFieldValues(
    userId: string,
    organizationId: string,
  ): Promise<Array<{ fieldId: string; value: unknown }>> {
    const profile = await this.db.query.organizationUserProfiles.findFirst({
      where: { userId, organizationId },
      columns: { id: true },
    });
    if (!profile) return [];

    return await this.db.query.formSubmissionValues.findMany({
      where: { organizationUserProfileId: profile.id },
      columns: { fieldId: true, value: true },
    });
  }

  async findStoredFieldValuesForOrgUnit(
    userId: string,
    organizationUnitId: string,
  ): Promise<Array<{ fieldId: string; value: unknown }>> {
    const organizationId =
      await this.organizationUnitDataService.findOrganizationIdByUnitId(
        organizationUnitId,
      );
    return this.findStoredFieldValues(userId, organizationId);
  }

  async findMySubmission(
    userId: string,
    id: string,
  ): Promise<FormSubmissionEntity | null> {
    const submission = await this.db.query.formSubmissions.findFirst({
      where: { id, userId },
      with: {
        form: {
          with: { blockRefs: { with: { block: { with: { fields: true } } } } },
        },
        values: true,
      },
    });

    return submission ?? null;
  }

  async findValuesBySubmissionId(submissionId: string) {
    return this.db.query.formSubmissionValues.findMany({
      where: { submissionId },
    });
  }

  async findByMembershipRequestForAdmin(
    membershipRequestId: string,
    orgUnitId: string,
  ): Promise<FormSubmissionEntity[]> {
    const request = await this.db.query.membershipRequests.findFirst({
      where: { id: membershipRequestId, organizationUnitId: orgUnitId },
    });
    if (!request) {
      throw new NotFoundGraphQLError('Membership request not found');
    }
    if (!request.userId) {
      throw new ForbiddenGraphQLError(
        `Membership request ${membershipRequestId} has no user`,
      );
    }
    return this.findByUserAndOrgUnit(request.userId, orgUnitId);
  }

  async findByUserForAdmin(
    userId: string,
    orgUnitId: string,
  ): Promise<FormSubmissionEntity[]> {
    return this.findByUserAndOrgUnit(userId, orgUnitId);
  }

  async findByUserAndOrgUnit(
    userId: string,
    orgUnitId: string,
  ): Promise<FormSubmissionEntity[]> {
    return this.db.query.formSubmissions.findMany({
      where: { userId, organizationUnitId: orgUnitId },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async submit(
    token: string,
    input: SubmitFormInput,
    userId: string,
    organizationUnitId: string,
  ): Promise<FormSubmissionEntity> {
    const form = await this.db.query.requirementForms.findFirst({
      where: { shareToken: token },
    });

    if (!form) {
      throw new NotFoundGraphQLError('Form not found');
    }

    await isUnitInOrg(this.db, organizationUnitId, form.organizationId);

    return this.submitToForm(form, input, userId, organizationUnitId, {
      surface: POSTHOG_SURFACE.PUBLIC,
    });
  }

  async submitRequiredForm(
    target: RequiredFormTarget,
    formId: string,
    input: SubmitFormInput,
    userId: string,
  ): Promise<FormSubmissionEntity> {
    const requiredForms =
      await this.requiredFormService.getRequiredForms(target);
    const isRequired = requiredForms.some((item) => item.form.id === formId);

    if (!isRequired) {
      throw new ForbiddenGraphQLError(
        'This form is not required for the target',
      );
    }

    const form = await this.db.query.requirementForms.findFirst({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundGraphQLError('Form not found');
    }

    const organizationUnitId =
      await this.resolveTargetOrganizationUnitId(target);
    return this.submitToForm(form, input, userId, organizationUnitId, {
      surface: POSTHOG_SURFACE.VOLUNTEERING,
      targetType: target.targetType.toLowerCase(),
    });
  }

  private async resolveTargetOrganizationUnitId(
    target: RequiredFormTarget,
  ): Promise<string> {
    switch (target.targetType) {
      case RequiredFormTargetType.ORGANIZATION_UNIT:
        return target.targetId;
      case RequiredFormTargetType.EVENT: {
        const event = await this.db.query.events.findFirst({
          where: { id: target.targetId },
          columns: { organizationUnitId: true },
        });
        if (!event) throw new NotFoundGraphQLError('Event not found');
        return event.organizationUnitId;
      }
      case RequiredFormTargetType.SHIFT: {
        const shift = await this.db.query.shifts.findFirst({
          where: { id: target.targetId },
          columns: { organizationUnitId: true },
        });
        if (!shift) throw new NotFoundGraphQLError('Shift not found');
        return shift.organizationUnitId;
      }
      case RequiredFormTargetType.SHIFT_INSTANCE: {
        const instance = await this.db.query.shiftInstances.findFirst({
          where: { id: target.targetId },
          columns: { masterId: true },
        });
        if (!instance) {
          throw new NotFoundGraphQLError('Shift instance not found');
        }
        const shift = await this.db.query.shifts.findFirst({
          where: { id: instance.masterId },
          columns: { organizationUnitId: true },
        });
        if (!shift) throw new NotFoundGraphQLError('Shift not found');
        return shift.organizationUnitId;
      }
      default:
        throw new ConflictGraphQLError(
          `Unsupported required-form target: ${target.targetType}`,
        );
    }
  }

  private async submitToForm(
    form: schema.RequirementFormEntity,
    input: SubmitFormInput,
    userId: string,
    organizationUnitId: string,
    captureContext: { surface: PostHogSurface; targetType?: string },
  ): Promise<FormSubmissionEntity> {
    // Load block refs and fields
    const blockRefs = await this.db.query.requirementFormBlockRefs.findMany({
      where: { formId: form.id },
      orderBy: { fieldOrder: 'asc' },
    });

    const blockIds = blockRefs.map((ref) => ref.blockId);

    const fields =
      blockIds.length > 0
        ? await this.db
            .select()
            .from(schema.formBlockFields)
            .where(inArray(schema.formBlockFields.blockId, blockIds))
            .orderBy(schema.formBlockFields.fieldOrder)
        : [];

    const fieldsByBlockId = new Map<string, typeof fields>();
    for (const field of fields) {
      const list = fieldsByBlockId.get(field.blockId) ?? [];
      list.push(field);
      fieldsByBlockId.set(field.blockId, list);
    }

    // Gather all required fields
    const requiredFieldIds = new Set<string>();
    const fieldMap = new Map<
      string,
      {
        systemKey: string | null;
        type: string;
        label: string;
        options: string[] | null;
        minAge: number | null;
      }
    >();

    for (const ref of blockRefs) {
      const blockFields = fieldsByBlockId.get(ref.blockId) ?? [];
      for (const field of blockFields) {
        fieldMap.set(field.id, {
          systemKey: field.systemKey,
          type: field.type,
          label: field.label,
          options: field.options as string[] | null,
          minAge: field.minAge,
        });
        if (field.required) {
          requiredFieldIds.add(field.id);
        }
      }
    }

    // Validate required fields are present and non-empty
    const valuesByFieldId = new Map(
      input.values.map((v) => [v.fieldId, v.value]),
    );
    for (const requiredId of requiredFieldIds) {
      const fieldInfo = fieldMap.get(requiredId);
      const label = fieldInfo?.label ?? requiredId;
      const value = valuesByFieldId.get(requiredId);
      const isCheckboxType =
        fieldInfo?.type === FieldType.CHECKBOX ||
        fieldInfo?.type === FieldType.DOCUMENT_ACKNOWLEDGEMENT;
      const missing = isCheckboxType
        ? value !== 'true'
        : fieldInfo?.type === FieldType.MULTI_CHOICE
          ? parseMultiChoiceValue(value ?? '').length === 0
          : !value;
      if (missing) {
        throw new BadRequestGraphQLError(`Field "${label}" is required`);
      }
    }

    // Separate system fields from custom fields
    const profileData: Record<string, unknown> = {};
    const customValues: Array<{
      fieldId: string;
      value: unknown;
    }> = [];

    for (const valueInput of input.values) {
      const fieldInfo = fieldMap.get(valueInput.fieldId);
      if (!fieldInfo) {
        throw new BadRequestGraphQLError(
          `Unknown field: ${valueInput.fieldId}`,
        );
      }

      this.validateFieldValue(valueInput.value, fieldInfo);

      if (fieldInfo.systemKey && SYSTEM_PROFILE_KEYS.has(fieldInfo.systemKey)) {
        profileData[fieldInfo.systemKey] = this.parseValue(
          valueInput.value,
          fieldInfo.type,
        );
      } else {
        customValues.push({
          fieldId: valueInput.fieldId,
          value: this.parseValue(valueInput.value, fieldInfo.type),
        });
      }
    }

    const organizationUserProfile =
      await this.userService.findOrganizationUserProfile(
        userId,
        form.organizationId,
      );

    const existingSubmission = await this.findByUserFormAndOrgUnit(
      userId,
      form.id,
      organizationUnitId,
    );

    const customFieldIds = customValues.map((cv) => cv.fieldId);

    const submission = await this.db.transaction(async (tx) => {
      if (Object.keys(profileData).length > 0) {
        await this.userService.updateProfileFields(userId, profileData, tx);
      }

      // Disconnect any prior profile-anchored values for these fields so the
      // unique (profile, field) index can accept the new rows.
      if (customFieldIds.length > 0) {
        await tx
          .update(schema.formSubmissionValues)
          .set({ organizationUserProfileId: null })
          .where(
            and(
              eq(
                schema.formSubmissionValues.organizationUserProfileId,
                organizationUserProfile.id,
              ),
              inArray(schema.formSubmissionValues.fieldId, customFieldIds),
            ),
          );
      }

      let submissionRow: FormSubmissionEntity;

      if (existingSubmission) {
        await tx
          .delete(schema.formSubmissionValues)
          .where(
            eq(schema.formSubmissionValues.submissionId, existingSubmission.id),
          );

        const [updated] = await tx
          .update(schema.formSubmissions)
          .set({ submittedAt: new Date() })
          .where(eq(schema.formSubmissions.id, existingSubmission.id))
          .returning();
        submissionRow = updated;
      } else {
        const [created] = await tx
          .insert(schema.formSubmissions)
          .values({
            formId: form.id,
            userId,
            organizationUnitId,
            submittedAt: new Date(),
          })
          .returning();
        submissionRow = created;
      }

      if (customValues.length > 0) {
        await tx.insert(schema.formSubmissionValues).values(
          customValues.map((cv) => ({
            submissionId: submissionRow.id,
            fieldId: cv.fieldId,
            value: cv.value,
            organizationUserProfileId: organizationUserProfile.id,
          })),
        );
      }

      return submissionRow;
    });

    this.postHogService.capture({
      event: POSTHOG_EVENT.FORM_SUBMISSION_SUBMIT,
      userId,
      properties: {
        surface: captureContext.surface,
        organization_id: form.organizationId,
        organization_unit_id: organizationUnitId,
        target_type: captureContext.targetType,
      },
    });

    return submission;
  }

  private validateFieldValue(
    rawValue: string,
    field: {
      type: string;
      label: string;
      systemKey: string | null;
      options: string[] | null;
      minAge: number | null;
    },
  ): void {
    const { type, label, systemKey, options, minAge } = field;

    if (type === FieldType.STATIC_TEXT) return;
    if (!rawValue) return;

    switch (type) {
      case FieldType.TEXT:
        if (rawValue.length > 300)
          throw new BadRequestGraphQLError(
            `"${label}": must be 300 characters or fewer`,
          );
        break;
      case FieldType.NAME:
      case FieldType.LASTNAME:
        if (rawValue.length > 100)
          throw new BadRequestGraphQLError(
            `"${label}": must be 100 characters or fewer`,
          );
        break;
      case FieldType.ZIP:
        if (rawValue.length > 20)
          throw new BadRequestGraphQLError(
            `"${label}": must be 20 characters or fewer`,
          );
        break;
      case FieldType.TEXTAREA:
        if (rawValue.length > 5000)
          throw new BadRequestGraphQLError(
            `"${label}": must be 5000 characters or fewer`,
          );
        break;
      case FieldType.EMAIL:
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue) ||
          rawValue.length > 254
        )
          throw new BadRequestGraphQLError(
            `"${label}": must be a valid email address`,
          );
        break;
      case FieldType.PHONE:
        if (!/^\+?[\d\s\-().]{7,20}$/.test(rawValue))
          throw new BadRequestGraphQLError(
            `"${label}": must be a valid phone number`,
          );
        break;
      case FieldType.NUMBERS:
        if (!/^-?\d+(\.\d+)?$/.test(rawValue))
          throw new BadRequestGraphQLError(`"${label}": must be a number`);
        break;
      case FieldType.DATE:
        if (Number.isNaN(Date.parse(rawValue)))
          throw new BadRequestGraphQLError(`"${label}": must be a valid date`);
        break;
      case FieldType.SINGLE_CHOICE: {
        const valid = options ?? [];
        if (valid.length > 0 && !valid.includes(rawValue))
          throw new BadRequestGraphQLError(`"${label}": invalid option`);
        break;
      }
      case FieldType.MULTI_CHOICE: {
        const valid = new Set(options ?? []);
        const invalid = parseMultiChoiceValue(rawValue).filter(
          (v) => valid.size > 0 && !valid.has(v),
        );
        if (invalid.length > 0)
          throw new BadRequestGraphQLError(`"${label}": invalid option(s)`);
        break;
      }
      case FieldType.CHECKBOX:
      case FieldType.DOCUMENT_ACKNOWLEDGEMENT:
        if (rawValue !== 'true' && rawValue !== 'false')
          throw new BadRequestGraphQLError(`"${label}": must be true or false`);
        break;
    }

    if (systemKey) {
      this.validateSystemKey(rawValue, systemKey, label, minAge);
    }
  }

  private validateSystemKey(
    value: string,
    systemKey: string,
    label: string,
    minAge: number | null,
  ): void {
    validateSystemKeyValue(value, systemKey, label, minAge);
  }

  private parseValue(rawValue: string, fieldType: string): unknown {
    if (
      fieldType === FieldType.CHECKBOX ||
      fieldType === FieldType.DOCUMENT_ACKNOWLEDGEMENT
    ) {
      return rawValue === 'true';
    }
    if (fieldType === FieldType.MULTI_CHOICE) {
      return parseMultiChoiceValue(rawValue);
    }
    if (fieldType === FieldType.NUMBERS) {
      const num = Number(rawValue);
      return Number.isNaN(num) ? rawValue : num;
    }
    return rawValue;
  }
}
