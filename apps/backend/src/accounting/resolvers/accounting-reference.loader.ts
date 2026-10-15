import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { AuthService } from '../../auth/auth.service';
import { PermissionMapper } from '../../auth/mappers/permission.mapper';
import type { Permission } from '../../auth/models/permission.model';
import { RegisterLoader } from '../../graphql/interceptors';
import { TimeEntryMapper } from '../../time-tracking/mappers/time-entry.mapper';
import type { TimeEntry } from '../../time-tracking/models/time-entry.model';
import { TimeTrackingService } from '../../time-tracking/time-tracking.service';
import { ReimbursementTypeMapper } from '../mappers';
import type { ReimbursementType } from '../models/reimbursement-type.model';
import { ReimbursementRateService } from '../services';
import { settleEach } from './settle-each';

@RegisterLoader()
@Injectable({ scope: Scope.REQUEST })
export class AccountingReferenceLoader {
  constructor(
    private readonly reimbursementRateService: ReimbursementRateService,
    private readonly reimbursementTypeMapper: ReimbursementTypeMapper,
    private readonly authService: AuthService,
    private readonly permissionMapper: PermissionMapper,
    private readonly timeTrackingService: TimeTrackingService,
    private readonly timeEntryMapper: TimeEntryMapper,
  ) {}

  public readonly reimbursementTypeById = new DataLoader<
    string,
    ReimbursementType
  >((ids) =>
    settleEach(ids, async (id) =>
      this.reimbursementTypeMapper.toModelOrThrow(
        await this.reimbursementRateService.findReimbursementTypeById(id),
      ),
    ),
  );

  // Permissions are a tiny, rarely-changing reference table, so fetching
  // them all once per batch tick is simpler than adding a findByIds method.
  public readonly permissionById = new DataLoader<string, Permission | null>(
    async (ids) => {
      const permissions = await this.authService.findAllPermissions();
      const byId = new Map(
        permissions.map((permission) => [permission.id, permission]),
      );
      return ids.map((id) => this.permissionMapper.toModel(byId.get(id)));
    },
  );

  // Keyed by time-entry id only: callers must already have authorized the
  // parent (invoice claim). Do not use for org-scoped root queries.
  public readonly timeEntryById = new DataLoader<string, TimeEntry>((ids) =>
    settleEach(ids, async (id) =>
      this.timeEntryMapper.toModelOrThrow(
        await this.timeTrackingService.findByIdForAuthorizedParent(id),
      ),
    ),
  );
}
