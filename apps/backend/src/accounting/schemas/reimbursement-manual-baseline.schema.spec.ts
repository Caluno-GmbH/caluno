import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { createReimbursementType } from '../../../test/factories/accounting.factory';
import { createOrganizationWithType } from '../../../test/factories/org.factory';
import { createUser } from '../../../test/factories/user.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from '../../../test/helpers/ensure-test-database';
import { type Database, DatabaseModule } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { ReimbursementTypeKey } from '../enums';

describe('reimbursementManualBaselines schema', () => {
  let moduleRef: TestingModule;
  let db: Database;

  closeTestingModuleAfterAll(() => moduleRef);
  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);
  });

  it('enforces one row per organization + volunteer + reimbursement type + year', async () => {
    const { organization } = await createOrganizationWithType(
      db,
      `Manual Baseline Org ${crypto.randomUUID()}`,
    );
    const reimbursementType = await createReimbursementType(db, {
      key: ReimbursementTypeKey.EHRENAMT,
    });
    const volunteer = await createUser(db);

    await db
      .insert(schema.reimbursementManualBaselines)
      .values({
        organizationId: organization.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        year: 2026,
        amountCents: 10_000,
      })
      .execute();

    await expect(
      db
        .insert(schema.reimbursementManualBaselines)
        .values({
          organizationId: organization.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          year: 2026,
          amountCents: 20_000,
        })
        .execute(),
    ).rejects.toThrow();
  });

  it('allows the same volunteer + type + year in different organizations', async () => {
    const orgA = await createOrganizationWithType(
      db,
      `Manual Baseline Org A ${crypto.randomUUID()}`,
    );
    const orgB = await createOrganizationWithType(
      db,
      `Manual Baseline Org B ${crypto.randomUUID()}`,
    );
    const reimbursementType = await createReimbursementType(db, {
      key: ReimbursementTypeKey.EHRENAMT,
    });
    const volunteer = await createUser(db);

    await db
      .insert(schema.reimbursementManualBaselines)
      .values({
        organizationId: orgA.organization.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        year: 2026,
        amountCents: 10_000,
      })
      .execute();

    await expect(
      db
        .insert(schema.reimbursementManualBaselines)
        .values({
          organizationId: orgB.organization.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          year: 2026,
          amountCents: 20_000,
        })
        .execute(),
    ).resolves.toBeDefined();
  });

  it('allows the same volunteer + type across different years', async () => {
    const { organization } = await createOrganizationWithType(
      db,
      `Manual Baseline Org ${crypto.randomUUID()}`,
    );
    const reimbursementType = await createReimbursementType(db, {
      key: ReimbursementTypeKey.EHRENAMT,
    });
    const volunteer = await createUser(db);

    await db
      .insert(schema.reimbursementManualBaselines)
      .values({
        organizationId: organization.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        year: 2025,
        amountCents: 5_000,
      })
      .execute();

    await expect(
      db
        .insert(schema.reimbursementManualBaselines)
        .values({
          organizationId: organization.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          year: 2026,
          amountCents: 10_000,
        })
        .execute(),
    ).resolves.toBeDefined();
  });
});
