import 'reflect-metadata';
import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import { ForbiddenGraphQLError } from '../src/graphql/errors';
import { OrganizationUnitDataService } from '../src/organization/organization-unit-data.service';
import { RequiredFormTargetType } from '../src/requirement-profile/enums';
import { FormSubmissionService } from '../src/requirement-profile/services/form-submission.service';
import { RequiredFormService } from '../src/requirement-profile/services/required-form.service';
import { createRequiredFormTargetRegistry } from '../src/requirement-profile/targets';
import { PostHogService } from '../src/shared/observability/posthog.service';
import { UserService } from '../src/user/user.service';
import {
  createFormSubmission,
  createRequirementForm,
  createUser,
  setEventRequiredForms,
  setRequiredForms,
} from './factories';
import { createEvent } from './factories/event.factory';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createShift } from './factories/shift.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

describe('FormSubmissionService per-org-unit submissions', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let formSubmissionService: FormSubmissionService;

  closeTestingModuleAfterAll(() => moduleRef);
  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    const postHogService = { capture: () => {} } as unknown as PostHogService;
    const targetRegistry = createRequiredFormTargetRegistry(db, postHogService);
    const requiredFormService = new RequiredFormService(db, targetRegistry);
    formSubmissionService = new FormSubmissionService(
      db,
      new UserService(db, postHogService),
      requiredFormService,
      postHogService,
      new OrganizationUnitDataService(db),
      targetRegistry,
    );
  });

  const setupOrgWithUnits = async () => {
    const admin = await createUser(db);
    const { organization, type } = await createOrganizationWithType(
      db,
      `Form Submission Org ${crypto.randomUUID()}`,
    );
    const rootUnit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    const unitA = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'unit-a',
      parentId: rootUnit.id,
    });
    const unitB = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'unit-b',
      parentId: rootUnit.id,
    });
    const volunteer = await createUser(db);
    return { admin, organization, rootUnit, unitA, unitB, volunteer };
  };

  describe('findByUserAndOrgUnit', () => {
    it('returns a submission for that unit', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      const submission = await createFormSubmission(db, {
        formId: form.id,
        userId: volunteer.id,
        organizationUnitId: unitA.id,
      });

      const submissions = await formSubmissionService.findByUserAndOrgUnit(
        volunteer.id,
        unitA.id,
      );

      expect(submissions.map((s) => s.id)).toEqual([submission.id]);
    });

    it('does not return submissions for an unrelated unit', async () => {
      const { admin, rootUnit, unitA, unitB, volunteer } =
        await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      await createFormSubmission(db, {
        formId: form.id,
        userId: volunteer.id,
        organizationUnitId: unitA.id,
      });

      const submissions = await formSubmissionService.findByUserAndOrgUnit(
        volunteer.id,
        unitB.id,
      );

      expect(submissions).toEqual([]);
    });

    it('does not return submissions merely because the unit owns or requires the form', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });
      await createFormSubmission(db, {
        formId: form.id,
        userId: volunteer.id,
        organizationUnitId: rootUnit.id,
      });

      const [forOwner, forRequirer] = await Promise.all([
        formSubmissionService.findByUserAndOrgUnit(volunteer.id, rootUnit.id),
        formSubmissionService.findByUserAndOrgUnit(volunteer.id, unitA.id),
      ]);

      expect(forOwner).toHaveLength(1);
      expect(forRequirer).toEqual([]);
    });
  });

  describe('submitRequiredForm attribution', () => {
    it('attributes an ORGANIZATION_UNIT-target submission to that unit', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });

      const submission = await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        { values: [] },
        volunteer.id,
      );

      expect(submission.formId).toBe(form.id);
      expect(submission.organizationUnitId).toBe(unitA.id);
      expect(
        await formSubmissionService.findByUserAndOrgUnit(
          volunteer.id,
          rootUnit.id,
        ),
      ).toEqual([]);
    });

    it('attributes an EVENT-target submission to the event’s org unit', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      const event = await createEvent(db, {
        organizationUnitId: unitA.id,
      });
      await setEventRequiredForms(db, {
        eventId: event.id,
        formIds: [form.id],
      });

      const submission = await formSubmissionService.submitRequiredForm(
        { targetType: RequiredFormTargetType.EVENT, targetId: event.id },
        form.id,
        { values: [] },
        volunteer.id,
      );

      expect(submission.organizationUnitId).toBe(unitA.id);
      expect(
        await formSubmissionService.findByUserAndOrgUnit(
          volunteer.id,
          unitA.id,
        ),
      ).toHaveLength(1);
    });

    it('attributes a SHIFT_INSTANCE-target submission to the shift’s org unit', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      const shift = await createShift(db, {
        organizationUnitId: unitA.id,
      });
      const [instance] = await db.query.shiftInstances.findMany({
        where: { masterId: shift.id },
      });
      expect(instance).toBeDefined();
      await db.insert(schema.shiftInstanceRequiredForms).values({
        shiftInstanceId: instance.id,
        formId: form.id,
        order: 0,
      });

      const submission = await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.SHIFT_INSTANCE,
          targetId: instance.id,
        },
        form.id,
        { values: [] },
        volunteer.id,
      );

      expect(submission.organizationUnitId).toBe(unitA.id);
      expect(
        await formSubmissionService.findByUserAndOrgUnit(
          volunteer.id,
          unitA.id,
        ),
      ).toHaveLength(1);
    });
  });

  describe('per-unit submissions (never auto-share)', () => {
    it('creates a separate submission when another unit asks for the same form', async () => {
      const { admin, rootUnit, unitA, unitB, volunteer } =
        await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });
      const first = await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        { values: [] },
        volunteer.id,
      );

      await setRequiredForms(db, {
        organizationUnitId: unitB.id,
        formIds: [form.id],
      });
      const second = await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitB.id,
        },
        form.id,
        { values: [] },
        volunteer.id,
      );

      expect(second.id).not.toBe(first.id);
      expect(first.organizationUnitId).toBe(unitA.id);
      expect(second.organizationUnitId).toBe(unitB.id);
      const rows = await db.query.formSubmissions.findMany({
        where: { userId: volunteer.id, formId: form.id },
      });
      expect(rows).toHaveLength(2);
    });

    it('overwrites the existing submission for the same unit on re-submit', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form, field } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        required: false,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });

      const first = await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        {
          values: [
            { fieldId: field.id, blockId: field.blockId, value: 'first' },
          ],
        },
        volunteer.id,
      );
      const second = await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        {
          values: [
            { fieldId: field.id, blockId: field.blockId, value: 'second' },
          ],
        },
        volunteer.id,
      );

      expect(second.id).toBe(first.id);
      const values = await db.query.formSubmissionValues.findMany({
        where: { submissionId: first.id },
      });
      expect(values).toHaveLength(1);
      expect(values[0]?.value).toBe('second');

      const profileValues =
        await db.query.organizationUserProfileFieldValues.findMany({
          where: { fieldId: field.id },
        });
      expect(profileValues).toHaveLength(1);
      expect(profileValues[0]?.value).toBe('second');
    });
  });

  describe('submit by share token', () => {
    it('stores the submission for the unit from the link', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });

      const submission = await formSubmissionService.submit(
        form.shareToken,
        { values: [] },
        volunteer.id,
        unitA.id,
      );

      expect(submission.organizationUnitId).toBe(unitA.id);
      expect(
        await formSubmissionService.findByUserAndOrgUnit(
          volunteer.id,
          rootUnit.id,
        ),
      ).toEqual([]);
    });

    it('rejects a link unit outside the form’s organization', async () => {
      const { admin, rootUnit, volunteer } = await setupOrgWithUnits();
      const { form } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
      });
      const otherOrg = await createOrganizationWithType(
        db,
        `Other Org ${crypto.randomUUID()}`,
      );
      const otherUnit = await createUnit(db, {
        organizationId: otherOrg.organization.id,
        typeId: otherOrg.type.id,
        name: 'other-unit',
      });

      await expect(
        formSubmissionService.submit(
          form.shareToken,
          { values: [] },
          volunteer.id,
          otherUnit.id,
        ),
      ).rejects.toBeInstanceOf(ForbiddenGraphQLError);
    });
  });

  describe('profile-anchored values', () => {
    it('prefills from OrganizationUserProfile-linked values by fieldId', async () => {
      const { admin, organization, rootUnit, unitA, unitB, volunteer } =
        await setupOrgWithUnits();
      const { form, field } = await createRequirementForm(db, {
        organizationId: organization.id,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        required: false,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });
      await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        {
          values: [
            { fieldId: field.id, blockId: field.blockId, value: 'stored' },
          ],
        },
        volunteer.id,
      );

      const stored =
        await formSubmissionService.findStoredFieldValuesForOrgUnit(
          volunteer.id,
          unitB.id,
        );
      expect(stored).toEqual([{ fieldId: field.id, value: 'stored' }]);
    });

    it('does not store empty values on OrganizationUserProfileFieldValues', async () => {
      const { admin, organization, rootUnit, unitA, volunteer } =
        await setupOrgWithUnits();
      const { form, field } = await createRequirementForm(db, {
        organizationId: organization.id,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        required: false,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });

      await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        {
          values: [{ fieldId: field.id, blockId: field.blockId, value: '' }],
        },
        volunteer.id,
      );

      expect(
        await formSubmissionService.findStoredFieldValuesForOrgUnit(
          volunteer.id,
          unitA.id,
        ),
      ).toEqual([]);

      await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        {
          values: [
            { fieldId: field.id, blockId: field.blockId, value: 'kept' },
          ],
        },
        volunteer.id,
      );
      expect(
        await formSubmissionService.findStoredFieldValuesForOrgUnit(
          volunteer.id,
          unitA.id,
        ),
      ).toEqual([{ fieldId: field.id, value: 'kept' }]);

      await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        {
          values: [{ fieldId: field.id, blockId: field.blockId, value: '   ' }],
        },
        volunteer.id,
      );
      expect(
        await formSubmissionService.findStoredFieldValuesForOrgUnit(
          volunteer.id,
          unitA.id,
        ),
      ).toEqual([]);
    });

    it('merges profile values across forms: shared field updates, unshared fields kept', async () => {
      const { admin, organization, rootUnit, unitA, volunteer } =
        await setupOrgWithUnits();

      // FormA: fields A and B on one block
      const {
        form: formA,
        block: blockAB,
        field: fieldA,
      } = await createRequirementForm(db, {
        organizationId: organization.id,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        name: `FormA ${crypto.randomUUID()}`,
        required: false,
      });
      const [fieldB] = await db
        .insert(schema.formBlockFields)
        .values({
          blockId: blockAB.id,
          type: 'text',
          label: 'Field B',
          required: false,
          fieldOrder: 1,
        })
        .returning();
      if (!fieldB) throw new Error('Failed to create field B');

      // FormB: field C on its own block; also includes FormA's block so field A is shared
      const {
        form: formB,
        block: blockC,
        field: fieldC,
      } = await createRequirementForm(db, {
        organizationId: organization.id,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        name: `FormB ${crypto.randomUUID()}`,
        required: false,
      });
      await db.insert(schema.requirementFormBlockRefs).values({
        formId: formB.id,
        blockId: blockAB.id,
        fieldOrder: 1,
      });

      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [formA.id, formB.id],
      });

      await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        formA.id,
        {
          values: [
            { fieldId: fieldA.id, blockId: blockAB.id, value: 'A1' },
            { fieldId: fieldB.id, blockId: blockAB.id, value: 'B1' },
          ],
        },
        volunteer.id,
      );

      await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        formB.id,
        {
          values: [
            { fieldId: fieldA.id, blockId: blockAB.id, value: 'A2' },
            { fieldId: fieldC.id, blockId: blockC.id, value: 'C2' },
          ],
        },
        volunteer.id,
      );

      const stored =
        await formSubmissionService.findStoredFieldValuesForOrgUnit(
          volunteer.id,
          unitA.id,
        );
      expect(stored).toHaveLength(3);
      expect(stored).toEqual(
        expect.arrayContaining([
          { fieldId: fieldA.id, value: 'A2' },
          { fieldId: fieldB.id, value: 'B1' },
          { fieldId: fieldC.id, value: 'C2' },
        ]),
      );
    });
  });

  describe('gender system field', () => {
    const setupGenderForm = async (required: boolean) => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form, block } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        required,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });
      await db
        .update(schema.formBlockFields)
        .set({ required: false })
        .where(eq(schema.formBlockFields.blockId, block.id));
      const [genderField] = await db
        .insert(schema.formBlockFields)
        .values({
          blockId: block.id,
          type: 'SINGLE_CHOICE',
          label: 'Gender',
          required,
          profileKey: 'gender',
          options: [],
          fieldOrder: 1,
        })
        .returning();
      if (!genderField) throw new Error('Failed to create gender field');
      return { form, block, unitA, volunteer, genderField };
    };

    const submit = (
      formId: string,
      unitId: string,
      userId: string,
      values: { fieldId: string; blockId: string; value: string }[],
    ) =>
      formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitId,
        },
        formId,
        { values },
        userId,
      );

    it('accepts a fixed option value and writes it to the user profile', async () => {
      const { form, block, unitA, volunteer, genderField } =
        await setupGenderForm(false);
      await submit(form.id, unitA.id, volunteer.id, [
        { fieldId: genderField.id, blockId: block.id, value: 'female' },
      ]);
      const user = await db.query.users.findFirst({
        where: { id: volunteer.id },
      });
      expect(user?.gender).toBe('female');
    });

    it('merges profileKey values onto user columns without wiping unset fields', async () => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      await db
        .update(schema.users)
        .set({ gender: 'female', phone: '+49 30 111' })
        .where(eq(schema.users.id, volunteer.id));

      const { form, block } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        required: false,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });
      await db
        .update(schema.formBlockFields)
        .set({ required: false })
        .where(eq(schema.formBlockFields.blockId, block.id));
      const [phoneField] = await db
        .insert(schema.formBlockFields)
        .values({
          blockId: block.id,
          type: 'PHONE',
          label: 'Phone',
          required: false,
          profileKey: 'phone',
          fieldOrder: 1,
        })
        .returning();
      if (!phoneField) throw new Error('Failed to create phone field');

      await formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitA.id,
        },
        form.id,
        {
          values: [
            {
              fieldId: phoneField.id,
              blockId: block.id,
              value: '+49 30 999',
            },
          ],
        },
        volunteer.id,
      );

      const user = await db.query.users.findFirst({
        where: { id: volunteer.id },
      });
      expect(user?.phone).toBe('+49 30 999');
      expect(user?.gender).toBe('female');
    });

    it('rejects a value outside the fixed list', async () => {
      const { form, block, unitA, volunteer, genderField } =
        await setupGenderForm(false);
      await expect(
        submit(form.id, unitA.id, volunteer.id, [
          { fieldId: genderField.id, blockId: block.id, value: 'Weiblich' },
        ]),
      ).rejects.toThrow('must be one of the available gender options');
    });

    it('enforces a required gender but accepts prefer-not-to-say', async () => {
      const { form, block, unitA, volunteer, genderField } =
        await setupGenderForm(true);
      await expect(submit(form.id, unitA.id, volunteer.id, [])).rejects.toThrow(
        'is required',
      );
      await submit(form.id, unitA.id, volunteer.id, [
        {
          fieldId: genderField.id,
          blockId: block.id,
          value: 'prefer-not-to-say',
        },
      ]);
      const user = await db.query.users.findFirst({
        where: { id: volunteer.id },
      });
      expect(user?.gender).toBe('prefer-not-to-say');
    });
  });
});
