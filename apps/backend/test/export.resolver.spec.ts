import { describe, expect, it, mock } from 'bun:test';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../src/auth/constants';
import { ExportTable } from '../src/export/enums';
import { ExportResolver } from '../src/export/export.resolver';
import type { ExportTableInput } from '../src/export/models/export.model';
import { ForbiddenGraphQLError } from '../src/graphql/errors';
import type { AuthenticatedGraphQLContext } from '../src/graphql/graphql.context';

describe('ExportResolver', () => {
  const context = {
    organizationUnitId: 'unit-1',
  } as AuthenticatedGraphQLContext;

  const session = {
    user: { id: 'actor-1' },
  } as UserSession;

  describe('exportTableCsv', () => {
    it('rejects a timesheets export from a user lacking SHIFT_EDIT', async () => {
      const authService = {
        hasRequiredPermissions: mock(async () => false),
      };
      const exportService = {
        generateExport: mock(async () => ({
          filename: 'timesheets-export-20261111-1200.csv',
          content: 'id,name',
        })),
      };
      const exportLogService = { listExportLogs: mock(async () => []) };
      const userService = { findById: mock(async () => undefined) };

      const resolver = new ExportResolver(
        authService as never,
        exportService as never,
        exportLogService as never,
        userService as never,
      );

      const input: ExportTableInput = {
        tableKind: ExportTable.TIMESHEETS,
        rowIds: ['row-1'],
        columns: ['id', 'volunteerName'],
        includeTechnicalIds: false,
      };

      await expect(
        resolver.exportTableCsv(input, context, session),
      ).rejects.toBeInstanceOf(ForbiddenGraphQLError);

      expect(exportService.generateExport).not.toHaveBeenCalled();
    });

    it('delegates to ExportService when permitted and returns its {filename, content}', async () => {
      const authService = {
        hasRequiredPermissions: mock(async () => true),
      };
      const exportService = {
        generateExport: mock(async () => ({
          filename: 'timesheets-export-20261111-1200.csv',
          content: 'id,name\nrow-1,Alice',
        })),
      };
      const exportLogService = { listExportLogs: mock(async () => []) };
      const userService = { findById: mock(async () => undefined) };

      const resolver = new ExportResolver(
        authService as never,
        exportService as never,
        exportLogService as never,
        userService as never,
      );

      const input: ExportTableInput = {
        tableKind: ExportTable.TIMESHEETS,
        rowIds: ['row-1'],
        columns: ['id', 'volunteerName'],
        includeTechnicalIds: false,
      };

      const result = await resolver.exportTableCsv(input, context, session);

      expect(exportService.generateExport).toHaveBeenCalledWith({
        tableKind: ExportTable.TIMESHEETS,
        rowIds: ['row-1'],
        columns: ['id', 'volunteerName'],
        includeTechnicalIds: false,
        organizationUnitId: 'unit-1',
        actorUserId: 'actor-1',
      });
      expect(result.filename).toBe('timesheets-export-20261111-1200.csv');
      expect(result.content).toBe('id,name\nrow-1,Alice');
    });

    it('requires VOLUNTEER_EDIT to export extended personal columns from timesheets', async () => {
      const authService = {
        // A user with SHIFT_EDIT but WITHOUT VOLUNTEER_EDIT.
        hasRequiredPermissions: mock(
          async (_userId: string, _orgUnitId: string, perms: string[]) =>
            !perms.includes(PERMISSIONS.VOLUNTEER_EDIT),
        ),
      };
      const exportService = {
        generateExport: mock(async () => ({ filename: '', content: '' })),
      };
      const exportLogService = { listExportLogs: mock(async () => []) };
      const userService = { findById: mock(async () => undefined) };

      const resolver = new ExportResolver(
        authService as never,
        exportService as never,
        exportLogService as never,
        userService as never,
      );

      const input: ExportTableInput = {
        tableKind: ExportTable.TIMESHEETS,
        rowIds: ['row-1'],
        // DOB is extended PII — must not be exportable without VOLUNTEER_EDIT.
        columns: ['volunteerName', 'volunteerDateOfBirth'],
        includeTechnicalIds: false,
      };

      await expect(
        resolver.exportTableCsv(input, context, session),
      ).rejects.toBeInstanceOf(ForbiddenGraphQLError);

      expect(authService.hasRequiredPermissions).toHaveBeenCalledWith(
        'actor-1',
        'unit-1',
        [PERMISSIONS.SHIFT_EDIT, PERMISSIONS.VOLUNTEER_EDIT],
      );
      expect(exportService.generateExport).not.toHaveBeenCalled();
    });

    it('does not require VOLUNTEER_EDIT for timesheet exports without extended columns', async () => {
      const authService = {
        hasRequiredPermissions: mock(async () => true),
      };
      const exportService = {
        generateExport: mock(async () => ({ filename: 'f', content: 'c' })),
      };
      const exportLogService = { listExportLogs: mock(async () => []) };
      const userService = { findById: mock(async () => undefined) };

      const resolver = new ExportResolver(
        authService as never,
        exportService as never,
        exportLogService as never,
        userService as never,
      );

      const input: ExportTableInput = {
        tableKind: ExportTable.TIMESHEETS,
        rowIds: ['row-1'],
        columns: ['volunteerName', 'volunteerEmail', 'duration'],
        includeTechnicalIds: false,
      };

      await resolver.exportTableCsv(input, context, session);

      expect(authService.hasRequiredPermissions).toHaveBeenCalledWith(
        'actor-1',
        'unit-1',
        [PERMISSIONS.SHIFT_EDIT],
      );
    });
  });

  describe('exportLogs', () => {
    it('maps export logs to ExportLogEntry with actorName resolved', async () => {
      const authService = {
        hasRequiredPermissions: mock(async () => true),
      };
      const exportService = {
        generateExport: mock(async () => ({ filename: '', content: '' })),
      };
      const exportLogService = {
        listExportLogs: mock(async () => [
          {
            id: 'log-1',
            organizationUnitId: 'unit-1',
            actorUserId: 'actor-1',
            tableKind: ExportTable.TIMESHEETS,
            columns: ['id', 'volunteerName'],
            includedTechnicalIds: false,
            rowCount: 5,
            subjectUserIds: ['user-1', 'user-2'],
            occurredAt: new Date('2026-11-11T12:00:00.000Z'),
          },
        ]),
      };
      const userService = {
        findById: mock(async (id: string) =>
          id === 'actor-1' ? { id: 'actor-1', name: 'Alice Admin' } : undefined,
        ),
      };

      const resolver = new ExportResolver(
        authService as never,
        exportService as never,
        exportLogService as never,
        userService as never,
      );

      const entries = await resolver.exportLogs(undefined, context);

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('log-1');
      expect(entries[0].actorName).toBe('Alice Admin');
      expect(entries[0].tableKind).toBe(ExportTable.TIMESHEETS);
      expect(entries[0].columns).toEqual(['id', 'volunteerName']);
      expect(entries[0].includedTechnicalIds).toBe(false);
      expect(entries[0].rowCount).toBe(5);
      expect(entries[0].subjectUserIds).toEqual(['user-1', 'user-2']);
    });
  });
});
