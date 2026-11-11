import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import { ExportTable } from '../src/export/enums';
import { ExportLogService } from '../src/export/export-log.service';
import { createUser } from './factories';
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

  it('records an export and lists it back for the org unit', async () => {
    const orgUnitId = crypto.randomUUID();
    const actor = await createUser(db);
    const actorUserId = actor.id;

    const recorded = await service.recordExport({
      organizationUnitId: orgUnitId,
      actorUserId,
      tableKind: ExportTable.TIMESHEETS,
      columns: ['name', 'hours'],
      includedTechnicalIds: false,
      rowCount: 3,
      subjectUserIds: ['u1', 'u2'],
    });

    const logs = await service.listExportLogs(orgUnitId);

    expect(logs).toHaveLength(1);
    expect(logs[0].tableKind).toBe(ExportTable.TIMESHEETS);
    expect(logs[0].columns).toEqual(['name', 'hours']);
    expect(logs[0].rowCount).toBe(3);
    expect(logs[0].subjectUserIds).toEqual(['u1', 'u2']);
    expect(logs[0].occurredAt).toBeTruthy();
    expect(logs[0].id).toBe(recorded.id);
  });

  it('filters the list by table kind', async () => {
    const orgUnitId = crypto.randomUUID();
    const actor = await createUser(db);
    const actorUserId = actor.id;

    await service.recordExport({
      organizationUnitId: orgUnitId,
      actorUserId,
      tableKind: ExportTable.TIMESHEETS,
      columns: ['name'],
      includedTechnicalIds: false,
      rowCount: 1,
      subjectUserIds: [],
    });

    await service.recordExport({
      organizationUnitId: orgUnitId,
      actorUserId,
      tableKind: ExportTable.USERS,
      columns: ['email'],
      includedTechnicalIds: true,
      rowCount: 2,
      subjectUserIds: [],
    });

    const logs = await service.listExportLogs(orgUnitId, ExportTable.USERS);

    expect(logs).toHaveLength(1);
    expect(logs[0].tableKind).toBe(ExportTable.USERS);
  });

  it('scopes the list to the org unit', async () => {
    const orgUnitIdA = crypto.randomUUID();
    const orgUnitIdB = crypto.randomUUID();
    const actor = await createUser(db);
    const actorUserId = actor.id;

    await service.recordExport({
      organizationUnitId: orgUnitIdA,
      actorUserId,
      tableKind: ExportTable.SHIFTS,
      columns: ['date'],
      includedTechnicalIds: false,
      rowCount: 5,
      subjectUserIds: [],
    });

    await service.recordExport({
      organizationUnitId: orgUnitIdB,
      actorUserId,
      tableKind: ExportTable.SHIFTS,
      columns: ['date'],
      includedTechnicalIds: false,
      rowCount: 7,
      subjectUserIds: [],
    });

    const logsA = await service.listExportLogs(orgUnitIdA);
    const logsB = await service.listExportLogs(orgUnitIdB);

    expect(logsA).toHaveLength(1);
    expect(logsA[0].organizationUnitId).toBe(orgUnitIdA);
    expect(logsB).toHaveLength(1);
    expect(logsB[0].organizationUnitId).toBe(orgUnitIdB);
  });
});
