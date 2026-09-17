import 'reflect-metadata';
import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import { BadRequestGraphQLError } from '../src/graphql/errors';
import { FieldType } from '../src/requirement-profile/enums';
import { FormBlockService } from '../src/requirement-profile/services/form-block.service';
import { PostHogService } from '../src/shared/observability/posthog.service';
import type { FileService } from '../src/storage/services/file.service';
import { createUser } from './factories';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createRequirementForm } from './factories/requirement-form.factory';
import {
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

describe('FormBlockService gender system field contract', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let formBlockService: FormBlockService;

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    formBlockService = new FormBlockService(
      db,
      {} as FileService,
      { capture: () => {} } as unknown as PostHogService,
    );

    registerTestResourceCleanup(async () => {
      await moduleRef.close();
    });
  });

  const setupOrgWithBlock = async () => {
    const user = await createUser(db);
    const { organization, type } = await createOrganizationWithType(
      db,
      `Gender Contract Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    const { block, field } = await createRequirementForm(db, {
      organizationId: organization.id,
      organizationUnitId: unit.id,
      createdById: user.id,
    });
    return { user, organization, unit, block, field };
  };

  it('createField rejects a gender field with a non-choice type', async () => {
    const { user, unit, block } = await setupOrgWithBlock();

    await expect(
      formBlockService.createField(
        block.id,
        unit.id,
        { type: FieldType.TEXT, label: 'Gender', systemKey: 'gender' },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('createField rejects a gender field with custom options', async () => {
    const { user, unit, block } = await setupOrgWithBlock();

    await expect(
      formBlockService.createField(
        block.id,
        unit.id,
        {
          type: FieldType.SINGLE_CHOICE,
          label: 'Gender',
          systemKey: 'gender',
          options: [{ label: 'Female', value: 'female' }],
        },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('createField accepts a gender single-choice field without options', async () => {
    const { user, unit, block } = await setupOrgWithBlock();

    const updated = await formBlockService.createField(
      block.id,
      unit.id,
      { type: FieldType.SINGLE_CHOICE, label: 'Gender', systemKey: 'gender' },
      user.id,
    );

    const fields = await formBlockService.findFields(block.id);
    expect(fields.some((f) => f.systemKey === 'gender')).toBe(true);
    expect(updated.id).toBe(block.id);
  });

  it('create rejects a block containing a gender field with a non-choice type', async () => {
    const { user, organization, unit } = await setupOrgWithBlock();

    await expect(
      formBlockService.create(
        {
          organizationId: organization.id,
          title: `Block ${crypto.randomUUID()}`,
          fields: [
            { type: FieldType.TEXT, label: 'Gender', systemKey: 'gender' },
          ],
        },
        unit.id,
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('updateField rejects binding an existing text field to gender', async () => {
    const { user, unit, field } = await setupOrgWithBlock();

    await expect(
      formBlockService.updateField(
        field.id,
        unit.id,
        { systemKey: 'gender' },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('updateField rejects adding options to an existing gender field', async () => {
    const { user, unit, block } = await setupOrgWithBlock();
    const [genderField] = await db
      .insert(schema.formBlockFields)
      .values({
        blockId: block.id,
        type: 'SINGLE_CHOICE',
        label: 'Gender',
        systemKey: 'gender',
        options: [],
        fieldOrder: 1,
      })
      .returning();
    if (!genderField) throw new Error('Failed to create gender field');

    await expect(
      formBlockService.updateField(
        genderField.id,
        unit.id,
        { options: [{ label: 'Female', value: 'female' }] },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });

  it('updateField allows a label-only update on a gender field', async () => {
    const { user, unit, block } = await setupOrgWithBlock();
    const [genderField] = await db
      .insert(schema.formBlockFields)
      .values({
        blockId: block.id,
        type: 'SINGLE_CHOICE',
        label: 'Gender',
        systemKey: 'gender',
        options: [],
        fieldOrder: 1,
      })
      .returning();
    if (!genderField) throw new Error('Failed to create gender field');

    await formBlockService.updateField(
      genderField.id,
      unit.id,
      { label: 'Gender identity' },
      user.id,
    );

    const updated = await db.query.formBlockFields.findFirst({
      where: { id: genderField.id },
    });
    expect(updated?.label).toBe('Gender identity');
    expect(updated?.systemKey).toBe('gender');
  });
});
