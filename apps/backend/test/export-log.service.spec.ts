import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import { ExportTable } from '../src/export/enums';
import { ExportLogService } from '../src/export/export-log.service';
import { createUser } from './factories';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

describe('ExportLogService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: ExportLogService;

  closeTestingModuleAfterAll(() => moduleRef);
  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);
    service = new ExportLogService(db);
  });

  const seedUnit = async () => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Export Log Org ${crypto.randomUUID()}`,
    );
    return createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `unit-${crypto.randomUUID()}`,
    });
  };

  it('records an export and lists it back for the org unit', async () => {
    const unit = await seedUnit();
    const actor = await createUser(db);

    const recorded = await service.recordExport({
      organizationUnitId: unit.id,
      actorUserId: actor.id,
      tableKind: ExportTable.TIMESHEETS,
      columns: ['name', 'hours'],
      includedTechnicalIds: false,
      rowCount: 3,
      subjectUserIds: ['u1', 'u2'],
    });

    const logs = await service.listExportLogs(unit.id);

    expect(logs).toHaveLength(1);
    expect(logs[0]?.tableKind).toBe(ExportTable.TIMESHEETS);
    expect(logs[0]?.columns).toEqual(['name', 'hours']);
    expect(logs[0]?.rowCount).toBe(3);
    expect(logs[0]?.subjectUserIds).toEqual(['u1', 'u2']);
    expect(logs[0]?.occurredAt).toBeTruthy();
    expect(logs[0]?.id).toBe(recorded.id);
  });

  it('filters the list by table kind', async () => {
    const unit = await seedUnit();
    const actor = await createUser(db);

    await service.recordExport({
      organizationUnitId: unit.id,
      actorUserId: actor.id,
      tableKind: ExportTable.TIMESHEETS,
      columns: ['name'],
      includedTechnicalIds: false,
      rowCount: 1,
      subjectUserIds: [],
    });
    await service.recordExport({
      organizationUnitId: unit.id,
      actorUserId: actor.id,
      tableKind: ExportTable.USERS,
      columns: ['email'],
      includedTechnicalIds: true,
      rowCount: 2,
      subjectUserIds: [],
    });

    const logs = await service.listExportLogs(unit.id, {
      tableKind: ExportTable.USERS,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.tableKind).toBe(ExportTable.USERS);
  });

  it('scopes the list to the org unit', async () => {
    const unitA = await seedUnit();
    const unitB = await seedUnit();
    const actor = await createUser(db);

    await service.recordExport({
      organizationUnitId: unitA.id,
      actorUserId: actor.id,
      tableKind: ExportTable.SHIFTS,
      columns: ['date'],
      includedTechnicalIds: false,
      rowCount: 5,
      subjectUserIds: [],
    });
    await service.recordExport({
      organizationUnitId: unitB.id,
      actorUserId: actor.id,
      tableKind: ExportTable.SHIFTS,
      columns: ['date'],
      includedTechnicalIds: false,
      rowCount: 7,
      subjectUserIds: [],
    });

    expect(await service.listExportLogs(unitA.id)).toHaveLength(1);
    expect((await service.listExportLogs(unitA.id))[0]?.rowCount).toBe(5);
    expect(await service.listExportLogs(unitB.id)).toHaveLength(1);
  });

  it('paginates the list', async () => {
    const unit = await seedUnit();
    const actor = await createUser(db);

    for (const rowCount of [1, 2, 3]) {
      await service.recordExport({
        organizationUnitId: unit.id,
        actorUserId: actor.id,
        tableKind: ExportTable.USERS,
        columns: ['name'],
        includedTechnicalIds: false,
        rowCount,
        subjectUserIds: [],
      });
    }

    expect(await service.listExportLogs(unit.id, { limit: 2 })).toHaveLength(2);
    expect(
      await service.listExportLogs(unit.id, { limit: 2, offset: 2 }),
    ).toHaveLength(1);
  });
});
