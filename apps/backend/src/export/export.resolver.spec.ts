import { describe, expect, it, mock } from 'bun:test';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../auth/constants';
import { ForbiddenGraphQLError } from '../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../graphql/graphql.context';
import { ExportTable } from './enums';
import { ExportResolver } from './export.resolver';
import { ExportLogMapper } from './mappers/export-log.mapper';
import type { ExportRowsInput } from './models/export.model';

const context = {
  organizationUnitId: 'unit-1',
} as AuthenticatedGraphQLContext;
const session = { user: { id: 'actor-1' } } as UserSession;

const input: ExportRowsInput = {
  rowIds: ['row-1'],
  columns: ['name'],
  includeTechnicalIds: false,
  includeSubUnits: false,
};

function buildResolver(authHasPermissions = true) {
  const exportService = {
    generateExport: mock(async () => ({
      filename: 'users-export.csv',
      downloadUrl: 'https://files.test/export-1',
    })),
    getColumns: mock(() => [{ id: 'name', label: 'Name' }]),
  };
  const exportLogService = {
    listExportLogs: mock(async () => [
      {
        id: 'log-1',
        organizationUnitId: 'unit-1',
        actorUserId: 'actor-1',
        tableKind: ExportTable.USERS,
        columns: ['name'],
        includedTechnicalIds: false,
        rowCount: 1,
        subjectUserIds: ['user-1'],
        occurredAt: new Date('2026-11-11T12:00:00.000Z'),
      },
    ]),
  };
  const userService = {
    findByIds: mock(async () => [{ id: 'actor-1', name: 'Alice Admin' }]),
  };
  const authService = {
    hasRequiredPermissions: mock(async () => authHasPermissions),
  };

  const resolver = new ExportResolver(
    exportService as never,
    exportLogService as never,
    new ExportLogMapper(),
    userService as never,
    authService as never,
  );

  return {
    resolver,
    exportService,
    exportLogService,
    userService,
    authService,
  };
}

describe('ExportResolver', () => {
  it('exportTimesheetsCsv delegates to the service with TIMESHEETS', async () => {
    const { resolver, exportService } = buildResolver();

    await resolver.exportTimesheetsCsv(input, context, session);

    expect(exportService.generateExport).toHaveBeenCalledWith(
      ExportTable.TIMESHEETS,
      {
        organizationUnitId: 'unit-1',
        actorUserId: 'actor-1',
        rowIds: ['row-1'],
        columns: ['name'],
        includeTechnicalIds: false,
        includeSubUnits: false,
      },
    );
  });

  it('exportShiftsCsv delegates to the service with SHIFTS', async () => {
    const { resolver, exportService } = buildResolver();

    await resolver.exportShiftsCsv(input, context, session);

    expect(exportService.generateExport).toHaveBeenCalledWith(
      ExportTable.SHIFTS,
      expect.objectContaining({ organizationUnitId: 'unit-1' }),
    );
  });

  it('exportUsersCsv delegates to the service with USERS', async () => {
    const { resolver, exportService } = buildResolver();

    await resolver.exportUsersCsv(input, context, session);

    expect(exportService.generateExport).toHaveBeenCalledWith(
      ExportTable.USERS,
      expect.objectContaining({ actorUserId: 'actor-1' }),
    );
  });

  it('exposes the exportable columns for a table', () => {
    const { resolver, exportService } = buildResolver();

    expect(resolver.exportColumns(ExportTable.USERS)).toEqual([
      { id: 'name', label: 'Name' },
    ]);
    expect(exportService.getColumns).toHaveBeenCalledWith(ExportTable.USERS);
  });

  it('lists export logs with the actor name resolved in one batch', async () => {
    const { resolver, exportLogService, userService } = buildResolver();

    const entries = await resolver.exportLogs(undefined, 50, 0, context);

    expect(exportLogService.listExportLogs).toHaveBeenCalledWith('unit-1', {
      tableKind: undefined,
      limit: 50,
      offset: 0,
    });
    expect(userService.findByIds).toHaveBeenCalledWith(['actor-1']);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actorName).toBe('Alice Admin');
    expect(entries[0]?.subjectUserIds).toEqual(['user-1']);
  });

  it('rejects extended timesheet columns without volunteer:edit', async () => {
    const { resolver, authService } = buildResolver(false);

    await expect(
      resolver.exportTimesheetsCsv(
        {
          rowIds: ['t1'],
          columns: ['volunteerGender'],
          includeTechnicalIds: false,
          includeSubUnits: false,
        },
        context,
        session,
      ),
    ).rejects.toBeInstanceOf(ForbiddenGraphQLError);

    expect(authService.hasRequiredPermissions).toHaveBeenCalledWith(
      session.user.id,
      context.organizationUnitId,
      [PERMISSIONS.VOLUNTEER_EDIT],
    );
  });

  it('allows extended timesheet columns when caller has volunteer:edit', async () => {
    const { resolver, exportService } = buildResolver(true);

    await resolver.exportTimesheetsCsv(
      {
        rowIds: ['t1'],
        columns: ['volunteerGender'],
        includeTechnicalIds: false,
        includeSubUnits: false,
      },
      context,
      session,
    );

    expect(exportService.generateExport).toHaveBeenCalledWith(
      ExportTable.TIMESHEETS,
      expect.objectContaining({ columns: ['volunteerGender'] }),
    );
  });

  it('does not check volunteer:edit for non-extended timesheet columns', async () => {
    const { resolver, authService, exportService } = buildResolver(false);

    await resolver.exportTimesheetsCsv(
      {
        rowIds: ['t1'],
        columns: ['volunteerName', 'shift'],
        includeTechnicalIds: false,
        includeSubUnits: false,
      },
      context,
      session,
    );

    expect(authService.hasRequiredPermissions).not.toHaveBeenCalled();
    expect(exportService.generateExport).toHaveBeenCalled();
  });
});
