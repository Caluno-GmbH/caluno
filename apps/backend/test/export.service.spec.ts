import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import { ExportTable } from '../src/export/enums';
import { ExportService } from '../src/export/export.service';
import { ExportLogService } from '../src/export/export-log.service';
import { SHIFT_COLUMNS } from '../src/export/serializers/shifts-export.serializer';
import { USER_COLUMNS } from '../src/export/serializers/users-export.serializer';
import { MembershipService } from '../src/membership/membership.service';
import { ShiftInviteStatus } from '../src/shift/enums';
import { ShiftService } from '../src/shift/shift.service';
import type { TimeTrackingService } from '../src/time-tracking/time-tracking.service';
import { createUser } from './factories';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { assignRoleToMembership, createRole } from './factories/role.factory';
import { createShift } from './factories/shift.factory';
import { createShiftInstance } from './factories/shift-instance.factory';
import { createShiftInstanceInvite } from './factories/shift-instance-invite.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

describe('ExportService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let exportLogService: ExportLogService;
  // Real membership service (DB-backed) so tenant scoping is exercised for real.
  let membershipService: MembershipService;

  const makeService = () =>
    new ExportService(
      db,
      {} as unknown as TimeTrackingService,
      membershipService,
      {} as unknown as ShiftService,
      exportLogService,
    );

  closeTestingModuleAfterAll(() => moduleRef);
  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);
    exportLogService = new ExportLogService(db);

    membershipService = new MembershipService(
      db,
      {} as never,
      {} as never,
      {} as never,
      { capture: () => {} } as never,
      {} as never,
    );
  });

  const seedUnitWithMember = async () => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Export Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'unit',
    });
    const user = await createUser(db, {
      firstname: 'Ada',
      lastname: 'Volunteer',
    });
    const membership = await addMembership(db, user.id, unit.id);
    const role = await createRole(db, {
      organizationId: organization.id,
      name: `Helper ${crypto.randomUUID()}`,
    });
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });
    return { organization, unit, user, membership, role };
  };

  it('generates a users CSV and writes one log record with subject user ids', async () => {
    const { unit, user, membership, role } = await seedUnitWithMember();
    const actor = await createUser(db);
    const service = makeService();

    const result = await service.generateExport({
      tableKind: ExportTable.USERS,
      organizationUnitId: unit.id,
      rowIds: [membership.id],
      columns: USER_COLUMNS,
      includeTechnicalIds: false,
      actorUserId: actor.id,
    });

    expect(result.filename).toMatch(/^users-unit-export-.+\.csv$/);
    const lines = result.content.trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Name,Email,Roles,Date of Birth,Gender,Phone,Address',
    );
    expect(lines.length).toBe(2);
    expect(result.content).toContain(user.name);
    expect(result.content).toContain(user.email);
    expect(result.content).toContain(role.name);

    const logs = await exportLogService.listExportLogs(
      unit.id,
      ExportTable.USERS,
    );
    expect(logs.length).toBe(1);
    expect(logs[0].rowCount).toBe(1);
    expect(logs[0].subjectUserIds).toEqual([user.id]);
    expect(logs[0].columns).toEqual(USER_COLUMNS);
    expect(logs[0].includedTechnicalIds).toBe(false);
    expect(logs[0].actorUserId).toBe(actor.id);
  });

  it('includes a filesystem-safe org unit name in the filename', async () => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Export Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'Altonaer Lese/paten',
    });
    const actor = await createUser(db);
    const service = makeService();

    const result = await service.generateExport({
      tableKind: ExportTable.USERS,
      organizationUnitId: unit.id,
      rowIds: [],
      columns: USER_COLUMNS,
      includeTechnicalIds: false,
      actorUserId: actor.id,
    });

    expect(result.filename).toMatch(
      /^users-Altonaer-Lese-paten-export-\d{8}-\d{4}\.csv$/,
    );
  });

  it('drops row ids belonging to another org unit', async () => {
    const home = await seedUnitWithMember();
    const foreign = await seedUnitWithMember();
    const actor = await createUser(db);
    const service = makeService();

    const result = await service.generateExport({
      tableKind: ExportTable.USERS,
      organizationUnitId: home.unit.id,
      rowIds: [home.membership.id, foreign.membership.id],
      columns: ['name', 'email', 'roles'],
      includeTechnicalIds: false,
      actorUserId: actor.id,
    });

    const lines = result.content.trimEnd().split('\r\n');
    expect(lines.length).toBe(2); // header + home row only
    expect(result.content).toContain(home.user.email);
    expect(result.content).not.toContain(foreign.user.email);

    const logs = await exportLogService.listExportLogs(
      home.unit.id,
      ExportTable.USERS,
    );
    const log = logs[0];
    expect(log.rowCount).toBe(1);
    expect(log.subjectUserIds).toEqual([home.user.id]);
    expect(log.subjectUserIds).not.toContain(foreign.user.id);
  });

  it('still logs an empty export (rowCount 0, header-only CSV)', async () => {
    const { unit } = await seedUnitWithMember();
    const actor = await createUser(db);
    const service = makeService();

    const result = await service.generateExport({
      tableKind: ExportTable.USERS,
      organizationUnitId: unit.id,
      rowIds: [],
      columns: ['name', 'email', 'roles'],
      includeTechnicalIds: false,
      actorUserId: actor.id,
    });

    const lines = result.content.trimEnd().split('\r\n');
    expect(lines.length).toBe(1); // header only
    expect(lines[0]).toBe('Name,Email,Roles');

    const logs = await exportLogService.listExportLogs(
      unit.id,
      ExportTable.USERS,
    );
    expect(logs.length).toBe(1);
    expect(logs[0].rowCount).toBe(0);
    expect(logs[0].subjectUserIds).toEqual([]);
  });

  it('exports one row per shift occurrence with per-occurrence staffing', async () => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Export Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'unit',
    });
    const actor = await createUser(db);
    const volunteer = await createUser(db);

    const shift = await createShift(db, {
      organizationUnitId: unit.id,
      title: 'Recurring Shift',
      location: 'Main Hall',
      maxVolunteers: 5,
    });
    // createShift seeds a first occurrence; add a second of the same master.
    const [firstInstance] = await db.query.shiftInstances.findMany({
      where: { masterId: shift.id },
    });
    const secondInstance = await createShiftInstance(db, shift.id, {
      actualStartsAt: new Date('2026-06-26T08:00:00.000Z'),
      actualEndsAt: new Date('2026-06-26T10:00:00.000Z'),
      occurrenceIndex: 2,
    });
    // The same volunteer participates in both occurrences.
    await createShiftInstanceInvite(db, {
      instanceId: firstInstance.id,
      userId: volunteer.id,
      status: ShiftInviteStatus.JOINED,
    });
    await createShiftInstanceInvite(db, {
      instanceId: secondInstance.id,
      userId: volunteer.id,
      status: ShiftInviteStatus.JOINED,
    });

    // collectShifts only touches ShiftService's db-backed read methods.
    const shiftService = new ShiftService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const service = new ExportService(
      db,
      {} as unknown as TimeTrackingService,
      membershipService,
      shiftService,
      exportLogService,
    );

    const result = await service.generateExport({
      tableKind: ExportTable.SHIFTS,
      organizationUnitId: unit.id,
      rowIds: [firstInstance.id, secondInstance.id],
      columns: SHIFT_COLUMNS,
      includeTechnicalIds: false,
      actorUserId: actor.id,
    });

    const lines = result.content.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Title,Date,Location,Visibility,Staffing');
    // One row per occurrence, not collapsed to a single master row.
    expect(lines.length).toBe(3);
    // Each occurrence counts its own single participant — not inflated to 2/5.
    for (const line of lines.slice(1)) {
      expect(line).toContain('Recurring Shift');
      expect(line.endsWith('1/5')).toBe(true);
    }

    const logs = await exportLogService.listExportLogs(
      unit.id,
      ExportTable.SHIFTS,
    );
    expect(logs[0].rowCount).toBe(2);
    expect(logs[0].subjectUserIds).toEqual([volunteer.id]);
  });
});
