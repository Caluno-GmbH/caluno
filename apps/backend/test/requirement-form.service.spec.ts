import 'reflect-metadata';
import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
} from '../src/graphql/errors';
import { RequiredFormService } from '../src/requirement-profile/services/required-form.service';
import { RequirementFormService } from '../src/requirement-profile/services/requirement-form.service';
import { createRequiredFormTargetRegistry } from '../src/requirement-profile/targets';
import { PostHogService } from '../src/shared/observability/posthog.service';
import { createShift, createUser, setShiftRequiredForms } from './factories';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import {
  createFormSubmission,
  createRequirementForm,
  setRequiredForms,
} from './factories/requirement-form.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

describe('RequirementFormService block org scoping', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let requirementFormService: RequirementFormService;

  closeTestingModuleAfterAll(() => moduleRef);
  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    const postHogService = {
      capture: () => {},
    } as unknown as PostHogService;
    requirementFormService = new RequirementFormService(
      db,
      new RequiredFormService(
        db,
        createRequiredFormTargetRegistry(db, postHogService),
      ),
      postHogService,
    );
  });

  const setupOrg = async (label: string) => {
    const user = await createUser(db);
    const { organization, type } = await createOrganizationWithType(
      db,
      `${label} ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    return { user, organization, type, unit };
  };

  it('create attaches blocks from the same organization', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { block } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });

    const form = await requirementFormService.create(
      {
        organizationId: organization.id,
        name: 'Scoped form',
        blockRefs: [{ blockId: block.id, order: 0 }],
      },
      unit.id,
      user.id,
    );

    const refs = await db.query.requirementFormBlockRefs.findMany({
      where: { formId: form.id },
    });
    expect(refs.map((r) => r.blockId)).toEqual([block.id]);
  });

  it('create rejects blocks from another organization', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const other = await setupOrg('Other Org');
    const { block: otherBlock } = await createRequirementForm(db, {
      organizationId: other.organization.id,
      organizationUnitId: other.unit.id,
      createdById: other.user.id,
    });

    await expect(
      requirementFormService.create(
        {
          organizationId: organization.id,
          name: 'Cross-org form',
          blockRefs: [{ blockId: otherBlock.id, order: 0 }],
        },
        unit.id,
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('update rejects attaching blocks from another organization', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const other = await setupOrg('Other Org');
    const { form } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    const { block: otherBlock } = await createRequirementForm(db, {
      organizationId: other.organization.id,
      organizationUnitId: other.unit.id,
      createdById: other.user.id,
    });

    await expect(
      requirementFormService.update(
        form.id,
        unit.id,
        { blockRefs: [{ blockId: otherBlock.id, order: 0 }] },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);

    // The rejected update must not have replaced the existing refs
    const refs = await db.query.requirementFormBlockRefs.findMany({
      where: { formId: form.id },
    });
    expect(refs.some((r) => r.blockId === otherBlock.id)).toBe(false);
  });

  it('update attaches blocks from the same organization', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    const { block: ownBlock } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
      name: 'Second form',
    });

    await requirementFormService.update(
      form.id,
      unit.id,
      { blockRefs: [{ blockId: ownBlock.id, order: 0 }] },
      user.id,
    );

    const refs = await db.query.requirementFormBlockRefs.findMany({
      where: { formId: form.id },
    });
    expect(refs.map((r) => r.blockId)).toEqual([ownBlock.id]);
  });

  it('rejects unknown block ids', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');

    await expect(
      requirementFormService.create(
        {
          organizationId: organization.id,
          name: 'Unknown block form',
          blockRefs: [{ blockId: crypto.randomUUID(), order: 0 }],
        },
        unit.id,
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('update rejects empty block refs', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });

    await expect(
      requirementFormService.update(
        form.id,
        unit.id,
        { blockRefs: [] },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('update rejects null block refs', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });

    await expect(
      requirementFormService.update(
        form.id,
        unit.id,
        { blockRefs: null },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('update allows name and description when form has submissions', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    await createFormSubmission(db, {
      formId: form.id,
      userId: user.id,
      organizationUnitId: unit.id,
    });

    const updated = await requirementFormService.update(
      form.id,
      unit.id,
      {
        name: 'Renamed after submissions',
        description: 'Updated description',
      },
      user.id,
    );

    expect(updated.name).toBe('Renamed after submissions');
    expect(updated.description).toBe('Updated description');
  });

  it('update rejects blockRefs when form has submissions', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form, block } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    const { block: otherBlock } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
      name: 'Second form',
    });
    await createFormSubmission(db, {
      formId: form.id,
      userId: user.id,
      organizationUnitId: unit.id,
    });

    await expect(
      requirementFormService.update(
        form.id,
        unit.id,
        { blockRefs: [{ blockId: otherBlock.id, order: 0 }] },
        user.id,
      ),
    ).rejects.toBeInstanceOf(ConflictGraphQLError);

    const refs = await db.query.requirementFormBlockRefs.findMany({
      where: { formId: form.id },
    });
    expect(refs.map((r) => r.blockId)).toEqual([block.id]);
  });

  it('update rejects settings when form has submissions', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    await createFormSubmission(db, {
      formId: form.id,
      userId: user.id,
      organizationUnitId: unit.id,
    });

    await expect(
      requirementFormService.update(
        form.id,
        unit.id,
        { settings: { successTitle: 'Changed after submit' } },
        user.id,
      ),
    ).rejects.toBeInstanceOf(ConflictGraphQLError);

    const reloaded = await db.query.requirementForms.findFirst({
      where: { id: form.id },
    });
    expect(reloaded?.settings).toEqual(form.settings);
  });

  it('delete removes form with submissions and detaches required-form links', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    await createFormSubmission(db, {
      formId: form.id,
      userId: user.id,
      organizationUnitId: unit.id,
    });
    await setRequiredForms(db, {
      organizationUnitId: unit.id,
      formIds: [form.id],
    });

    const shift = await createShift(db, { organizationUnitId: unit.id });
    await setShiftRequiredForms(db, {
      shiftId: shift.id,
      formIds: [form.id],
    });

    const impact = await requirementFormService.getDeleteImpact(
      form.id,
      unit.id,
    );
    expect(impact.submissionCount).toBe(1);
    expect(impact.attachments).toEqual([
      expect.objectContaining({
        targetType: 'ORGANIZATION_UNIT',
        targetId: unit.id,
        name: unit.name,
      }),
      expect.objectContaining({
        targetType: 'SHIFT',
        targetId: shift.id,
        name: shift.title,
      }),
    ]);

    await requirementFormService.delete(form.id, unit.id, user.id);

    expect(
      await db.query.requirementForms.findFirst({ where: { id: form.id } }),
    ).toBeUndefined();
    expect(
      await db.query.formSubmissions.findMany({ where: { formId: form.id } }),
    ).toEqual([]);
    expect(
      await db.query.organizationUnitRequiredForms.findMany({
        where: { formId: form.id },
      }),
    ).toEqual([]);
    expect(
      await db.query.shiftRequiredForms.findMany({
        where: { formId: form.id },
      }),
    ).toEqual([]);
  });

  it('delete leaves organization user profile field values intact', async () => {
    const { user, organization, unit } = await setupOrg('Form Org');
    const { form, field } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    const [profile] = await db
      .insert(schema.organizationUserProfiles)
      .values({
        organizationId: organization.id,
        userId: user.id,
      })
      .returning();
    if (!profile) throw new Error('Failed to create profile');

    await db.insert(schema.organizationUserProfileFieldValues).values({
      organizationUserProfileId: profile.id,
      fieldId: field.id,
      value: 'keep-me',
    });
    await createFormSubmission(db, {
      formId: form.id,
      userId: user.id,
      organizationUnitId: unit.id,
    });

    await requirementFormService.delete(form.id, unit.id, user.id);

    const profileValues =
      await db.query.organizationUserProfileFieldValues.findMany({
        where: { organizationUserProfileId: profile.id },
      });
    expect(profileValues).toEqual([
      expect.objectContaining({ fieldId: field.id, value: 'keep-me' }),
    ]);
  });
});
