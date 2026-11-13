import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../auth/auth.service';
import { PERMISSIONS } from '../auth/constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ForbiddenGraphQLError } from '../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../graphql/graphql.context';
import { UserService } from '../user/user.service';
import { ExportTable } from './enums';
import { ExportService } from './export.service';
import { ExportLogService } from './export-log.service';
import {
  ExportFile,
  ExportLogEntry,
  ExportTableInput,
} from './models/export.model';

const TABLE_KIND_PERMISSION: Record<ExportTable, string> = {
  [ExportTable.TIMESHEETS]: PERMISSIONS.SHIFT_EDIT,
  [ExportTable.SHIFTS]: PERMISSIONS.SHIFT_EDIT,
  [ExportTable.USERS]: PERMISSIONS.VOLUNTEER_EDIT,
};

@Resolver()
export class ExportResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly exportService: ExportService,
    private readonly exportLogService: ExportLogService,
    private readonly userService: UserService,
  ) {}

  @Mutation(() => ExportFile)
  async exportTableCsv(
    @Args('input') input: ExportTableInput,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<ExportFile> {
    const requiredPermission = TABLE_KIND_PERMISSION[input.tableKind];
    const allowed = await this.authService.hasRequiredPermissions(
      session.user.id,
      context.organizationUnitId,
      [requiredPermission],
    );
    if (!allowed) {
      throw new ForbiddenGraphQLError('Insufficient permissions');
    }
    return this.exportService.generateExport({
      ...input,
      organizationUnitId: context.organizationUnitId,
      actorUserId: session.user.id,
    });
  }

  @Permissions(PERMISSIONS.ORG_EDIT)
  @Query(() => [ExportLogEntry])
  async exportLogs(
    @Args('tableKind', { type: () => ExportTable, nullable: true })
    tableKind: ExportTable | undefined,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<ExportLogEntry[]> {
    const logs = await this.exportLogService.listExportLogs(
      context.organizationUnitId,
      tableKind,
    );

    // Resolve each distinct actor once; an unresolved actor degrades to a
    // placeholder rather than leaking its raw id or failing the whole query.
    const actorIds = [
      ...new Set(
        logs
          .map((log) => log.actorUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const actorNameById = new Map<string, string>();
    await Promise.all(
      actorIds.map(async (id) => {
        try {
          const actor = await this.userService.findById(id);
          if (actor?.name) actorNameById.set(id, actor.name);
        } catch {
          // Leave unresolved; the placeholder below is used.
        }
      }),
    );

    return logs.map((log) => ({
      id: log.id,
      actorName:
        (log.actorUserId && actorNameById.get(log.actorUserId)) ?? 'Unknown',
      tableKind: log.tableKind,
      columns: log.columns,
      includedTechnicalIds: log.includedTechnicalIds,
      rowCount: log.rowCount,
      subjectUserIds: log.subjectUserIds,
      occurredAt: log.occurredAt,
    }));
  }
}
