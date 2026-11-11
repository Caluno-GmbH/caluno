import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MembershipModule } from '../membership/membership.module';
import { ShiftModule } from '../shift/shift.module';
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';
import { UserModule } from '../user/user.module';
import { ExportResolver } from './export.resolver';
import { ExportService } from './export.service';
import { ExportLogService } from './export-log.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UserModule,
    TimeTrackingModule,
    MembershipModule,
    ShiftModule,
  ],
  providers: [ExportService, ExportLogService, ExportResolver],
})
export class ExportModule {}
