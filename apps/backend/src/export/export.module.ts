import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MembershipModule } from '../membership/membership.module';
import { OrganizationUnitDataModule } from '../organization/organization-unit-data.module';
import { ShiftModule } from '../shift/shift.module';
import { StorageModule } from '../storage/storage.module';
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';
import { UserModule } from '../user/user.module';
import {
  EXPORT_COLLECTORS,
  type ExportCollector,
} from './collectors/export-collector';
import { ShiftsExportCollector } from './collectors/shifts-export.collector';
import { TimesheetsExportCollector } from './collectors/timesheets-export.collector';
import { UsersExportCollector } from './collectors/users-export.collector';
import { ExportResolver } from './export.resolver';
import { ExportService } from './export.service';
import { ExportLogService } from './export-log.service';
import { ExportLogMapper } from './mappers/export-log.mapper';

@Module({
  imports: [
    DatabaseModule,
    OrganizationUnitDataModule,
    StorageModule,
    UserModule,
    TimeTrackingModule,
    MembershipModule,
    ShiftModule,
  ],
  providers: [
    ExportService,
    ExportLogService,
    ExportLogMapper,
    ExportResolver,
    TimesheetsExportCollector,
    UsersExportCollector,
    ShiftsExportCollector,
    {
      provide: EXPORT_COLLECTORS,
      useFactory: (
        timesheets: TimesheetsExportCollector,
        users: UsersExportCollector,
        shifts: ShiftsExportCollector,
      ): ExportCollector[] => [timesheets, users, shifts],
      inject: [
        TimesheetsExportCollector,
        UsersExportCollector,
        ShiftsExportCollector,
      ],
    },
  ],
})
export class ExportModule {}
