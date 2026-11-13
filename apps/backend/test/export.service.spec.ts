import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import { ExportTable } from '../src/export/enums';
import { MAX_EXPORT_ROW_IDS } from '../src/export/export.constants';
import { ExportModule } from '../src/export/export.module';
import { ExportService } from '../src/export/export.service';
import { ExportLogService } from '../src/export/export-log.service';
import { BadRequestGraphQLError } from '../src/graphql/errors';
import { AppI18nModule } from '../src/i18n/i18n.module';
import { ObservabilityModule } from '../src/shared/observability/observability.module';
import { FilePurpose } from '../src/storage/enums';
import { FileService } from '../src/storage/services/file.service';
import { createUser } from './factories';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createShift } from './factories/shift.factory';
import { createTimeEntry } from './factories/time-entry.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

type SavedFile = {
  id: string;
  filename: string;
  bytes: Buffer;
  purpose: FilePurpose;
};

describe('ExportService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let exportService: ExportService;
  let exportLogService: ExportLogService;
  const savedFiles: SavedFile[] = [];

  const fileService = {
    async saveGeneratedFile(args: {
      filename: string;
      bytes: Buffer;
      purpose: FilePurpose;
    }) {
      const file = { id: crypto.randomUUID(), filename: args.filename };
      savedFiles.push({
        id: file.id,
        filename: args.filename,
        bytes: args.bytes,
        purpose: args.purpose,
      });
      return file;
    },
    async presignDownload(_userId: string, fileId: string) {
      return { downloadUrl: `https://files.test/${fileId}` };
    },
  };

  const lastSaved = (): SavedFile => {
    const file = savedFiles.at(-1);
    if (!file) throw new Error('No file was saved');
    return file;
  };

  const csvOf = (file: SavedFile): string => file.bytes.toString('utf8');
  const csvLines = (file: SavedFile): string[] =>
    csvOf(file).split('\r\n').filter(Boolean);

  closeTestingModuleAfterAll(() => moduleRef);
  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
          global: true,
        }),
        ScheduleModule.forRoot(),
        DatabaseModule,
        ObservabilityModule,
        AppI18nModule,
        ExportModule,
      ],
    })
      .overrideProvider(FileService)
      .useValue(fileService)
      .compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);
    exportService = moduleRef.get(ExportService);
    exportLogService = moduleRef.get(ExportLogService);
  });

  const seedOrganization = async () => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Export Org ${crypto.randomUUID()}`,
    );
    const root = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `root-${crypto.randomUUID()}`,
    });
    const child = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `child-${crypto.randomUUID()}`,
      parentId: root.id,
    });
    return { organization, type, root, child };
  };

  const seedMember = async (organizationUnitId: string) => {
    const user = await createUser(db);
    const membership = await addMembership(db, user.id, organizationUnitId);
    return { user, membership };
  };

  it('generates a users CSV, stores it and records the effective columns', async () => {
    const { root } = await seedOrganization();
    const { user, membership } = await seedMember(root.id);
    const actor = await createUser(db);

    const result = await exportService.generateExport(ExportTable.USERS, {
      organizationUnitId: root.id,
      actorUserId: actor.id,
      rowIds: [membership.id],
      columns: ['email', 'name'],
      includeTechnicalIds: true,
      includeSubUnits: false,
    });

    expect(result.filename).toMatch(/^users-.+-export-\d{8}-\d{4}\.csv$/);
    expect(result.downloadUrl).toMatch(/^https:\/\/files\.test\//);

    const file = lastSaved();
    expect(file.purpose).toBe(FilePurpose.EXPORT);
    expect(csvLines(file)[0]).toBe('Name,Email,User ID');
    expect(csvOf(file)).toContain(user.email);

    const logs = await exportLogService.listExportLogs(root.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.tableKind).toBe(ExportTable.USERS);
    expect(logs[0]?.rowCount).toBe(1);
    expect(logs[0]?.columns).toEqual(['name', 'email']);
    expect(logs[0]?.subjectUserIds).toEqual([user.id]);
    expect(logs[0]?.actorUserId).toBe(actor.id);
  });

  it('drops membership ids from another unit unless sub-units are included', async () => {
    const { root, child } = await seedOrganization();
    const rootMember = await seedMember(root.id);
    const childMember = await seedMember(child.id);
    const actor = await createUser(db);

    const withoutSubUnits = await exportService.generateExport(
      ExportTable.USERS,
      {
        organizationUnitId: root.id,
        actorUserId: actor.id,
        rowIds: [rootMember.membership.id, childMember.membership.id],
        columns: ['email'],
        includeTechnicalIds: false,
        includeSubUnits: false,
      },
    );
    expect(withoutSubUnits.filename).toBeTruthy();
    expect(csvOf(lastSaved())).toContain(rootMember.user.email);
    expect(csvOf(lastSaved())).not.toContain(childMember.user.email);

    await exportService.generateExport(ExportTable.USERS, {
      organizationUnitId: root.id,
      actorUserId: actor.id,
      rowIds: [rootMember.membership.id, childMember.membership.id],
      columns: ['email'],
      includeTechnicalIds: false,
      includeSubUnits: true,
    });
    expect(csvOf(lastSaved())).toContain(rootMember.user.email);
    expect(csvOf(lastSaved())).toContain(childMember.user.email);
  });

  it('scopes timesheet rows to the unit tree only when sub-units are included', async () => {
    const { root, child } = await seedOrganization();
    const rootMember = await seedMember(root.id);
    const childMember = await seedMember(child.id);
    const actor = await createUser(db);

    const rootEntry = await createTimeEntry(db, {
      organizationUnitId: root.id,
      volunteerId: rootMember.user.id,
      startedAt: new Date('2026-01-15T10:00:00.000Z'),
      endedAt: new Date('2026-01-15T11:00:00.000Z'),
    });
    const childEntry = await createTimeEntry(db, {
      organizationUnitId: child.id,
      volunteerId: childMember.user.id,
      startedAt: new Date('2026-01-16T10:00:00.000Z'),
      endedAt: new Date('2026-01-16T11:00:00.000Z'),
    });

    const input = {
      organizationUnitId: root.id,
      actorUserId: actor.id,
      rowIds: [rootEntry.id, childEntry.id],
      columns: ['volunteerEmail'],
      includeTechnicalIds: false,
    };

    await exportService.generateExport(ExportTable.TIMESHEETS, {
      ...input,
      includeSubUnits: false,
    });
    expect(csvLines(lastSaved())).toHaveLength(2);
    expect(csvOf(lastSaved())).toContain(rootMember.user.email);
    expect(csvOf(lastSaved())).not.toContain(childMember.user.email);

    await exportService.generateExport(ExportTable.TIMESHEETS, {
      ...input,
      includeSubUnits: true,
    });
    expect(csvLines(lastSaved())).toHaveLength(3);
    expect(csvOf(lastSaved())).toContain(childMember.user.email);
  });

  it('scopes shift rows to the unit tree only when sub-units are included', async () => {
    const { root, child } = await seedOrganization();
    const actor = await createUser(db);

    const rootShift = await createShift(db, {
      organizationUnitId: root.id,
      title: `Root Shift ${crypto.randomUUID()}`,
    });
    const childShift = await createShift(db, {
      organizationUnitId: child.id,
      title: `Child Shift ${crypto.randomUUID()}`,
    });

    const input = {
      organizationUnitId: root.id,
      actorUserId: actor.id,
      rowIds: [rootShift.id, childShift.id],
      columns: ['title'],
      includeTechnicalIds: false,
    };

    await exportService.generateExport(ExportTable.SHIFTS, {
      ...input,
      includeSubUnits: false,
    });
    expect(csvOf(lastSaved())).toContain(rootShift.title);
    expect(csvOf(lastSaved())).not.toContain(childShift.title);

    await exportService.generateExport(ExportTable.SHIFTS, {
      ...input,
      includeSubUnits: true,
    });
    expect(csvOf(lastSaved())).toContain(rootShift.title);
    expect(csvOf(lastSaved())).toContain(childShift.title);
  });

  it('still stores an empty export with a header-only CSV', async () => {
    const { root } = await seedOrganization();
    const actor = await createUser(db);

    const result = await exportService.generateExport(ExportTable.USERS, {
      organizationUnitId: root.id,
      actorUserId: actor.id,
      rowIds: [],
      columns: ['name', 'email'],
      includeTechnicalIds: false,
      includeSubUnits: false,
    });

    expect(result.filename).toBeTruthy();
    expect(csvOf(lastSaved())).toBe('Name,Email\r\n');

    const logs = await exportLogService.listExportLogs(root.id);
    expect(logs[0]?.rowCount).toBe(0);
    expect(logs[0]?.subjectUserIds).toEqual([]);
  });

  it('rejects an unknown column instead of writing a partial file', async () => {
    const { root } = await seedOrganization();
    const actor = await createUser(db);
    const filesBefore = savedFiles.length;

    await expect(
      exportService.generateExport(ExportTable.USERS, {
        organizationUnitId: root.id,
        actorUserId: actor.id,
        rowIds: [],
        columns: ['name', 'not-a-column'],
        includeTechnicalIds: false,
        includeSubUnits: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
    expect(savedFiles).toHaveLength(filesBefore);
  });

  it('caps the number of row ids per request', async () => {
    const { root } = await seedOrganization();
    const actor = await createUser(db);

    await expect(
      exportService.generateExport(ExportTable.USERS, {
        organizationUnitId: root.id,
        actorUserId: actor.id,
        rowIds: Array.from({ length: MAX_EXPORT_ROW_IDS + 1 }, () =>
          crypto.randomUUID(),
        ),
        columns: ['name'],
        includeTechnicalIds: false,
        includeSubUnits: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestGraphQLError);
  });
});
