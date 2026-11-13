import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../auth/constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthService } from '../auth/auth.service';
import { ForbiddenGraphQLError } from '../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../graphql/graphql.context';
import { UserService } from '../user/user.service';
import { ExportTable } from './enums';
import {
  DEFAULT_EXPORT_LOG_PAGE_SIZE,
  MAX_EXPORT_LOG_PAGE_SIZE,
} from './export.constants';
import { ExportService, type GenerateExportInput } from './export.service';
import { ExportLogService } from './export-log.service';
import { ExportLogMapper } from './mappers/export-log.mapper';
import {
  ExportColumn,
  ExportFile,
  ExportLogEntry,
  ExportRowsInput,
} from './models/export.model';
import { EXTENDED_PERSONAL_COLUMNS } from './collectors/timesheets-export.collector';

/**
 * CSV export of one table at a time.
 *
 * Each mutation carries the stream's own permission so `PermissionGuard`
 * verifies the caller's membership and permission on the header unit before the
 * handler runs. There is deliberately no single "table kind" input whose
 * permission would have to be resolved dynamically.
 */
@Resolver()
export class ExportResolver {
  constructor(
    private readonly exportService: ExportService,
    private readonly exportLogService: ExportLogService,
    private readonly exportLogMapper: ExportLogMapper,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Permissions(PERMISSIONS.SHIFT_EDIT)
  @Mutation(() => ExportFile)
  async exportTimesheetsCsv(
    @Args('input') input: ExportRowsInput,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<ExportFile> {
    if (input.columns.some((c) => EXTENDED_PERSONAL_COLUMNS.has(c))) {
      const allowed = await this.authService.hasRequiredPermissions(
        session.user.id,
        context.organizationUnitId,
        [PERMISSIONS.VOLUNTEER_EDIT],
      );
      if (!allowed) {
        throw new ForbiddenGraphQLError('Insufficient permissions');
      }
    }
    return this.exportService.generateExport(
      ExportTable.TIMESHEETS,
      this.toServiceInput(input, context, session),
    );
  }

  @Permissions(PERMISSIONS.SHIFT_EDIT)
  @Mutation(() => ExportFile)
  exportShiftsCsv(
    @Args('input') input: ExportRowsInput,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<ExportFile> {
    return this.exportService.generateExport(
      ExportTable.SHIFTS,
      this.toServiceInput(input, context, session),
    );
  }

  @Permissions(PERMISSIONS.VOLUNTEER_EDIT)
  @Mutation(() => ExportFile)
  exportUsersCsv(
    @Args('input') input: ExportRowsInput,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<ExportFile> {
    return this.exportService.generateExport(
      ExportTable.USERS,
      this.toServiceInput(input, context, session),
    );
  }

  /** Column ids and labels for the export customization popup. */
  @Permissions(PERMISSIONS.ORG_VIEW)
  @Query(() => [ExportColumn])
  exportColumns(
    @Args('tableKind', { type: () => ExportTable }) tableKind: ExportTable,
  ): ExportColumn[] {
    return this.exportService.getColumns(tableKind);
  }

  @Permissions(PERMISSIONS.ORG_EDIT)
  @Query(() => [ExportLogEntry])
  async exportLogs(
    @Args('tableKind', { type: () => ExportTable, nullable: true })
    tableKind: ExportTable | undefined,
    @Args('limit', {
      type: () => Int,
      nullable: true,
      defaultValue: DEFAULT_EXPORT_LOG_PAGE_SIZE,
    })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<ExportLogEntry[]> {
    const logs = await this.exportLogService.listExportLogs(
      context.organizationUnitId,
      {
        tableKind,
        limit: Math.min(limit, MAX_EXPORT_LOG_PAGE_SIZE),
        offset,
      },
    );

    const actorIds = [
      ...new Set(
        logs.flatMap((log) => (log.actorUserId ? [log.actorUserId] : [])),
      ),
    ];
    const actors = actorIds.length
      ? await this.userService.findByIds(actorIds)
      : [];
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));

    return logs.flatMap((log) => {
      const entry = this.exportLogMapper.toModel(
        log,
        log.actorUserId ? actorNames.get(log.actorUserId) : undefined,
      );
      return entry ? [entry] : [];
    });
  }

  private toServiceInput(
    input: ExportRowsInput,
    context: AuthenticatedGraphQLContext,
    session: UserSession,
  ): GenerateExportInput {
    return {
      organizationUnitId: context.organizationUnitId,
      actorUserId: session.user.id,
      rowIds: input.rowIds,
      columns: input.columns,
      includeTechnicalIds: input.includeTechnicalIds,
      includeSubUnits: input.includeSubUnits,
    };
  }
}
