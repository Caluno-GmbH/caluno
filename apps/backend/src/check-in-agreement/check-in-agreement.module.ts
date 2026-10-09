import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationUnitDataModule } from '../organization/organization-unit-data.module';
import { ShiftModule } from '../shift/shift.module';
import { AgreementStatusService } from './check-in-agreement.service';
import { CheckInReadinessAgreementResolver } from './check-in-readiness-agreement.resolver';

@Module({
  imports: [
    AccountingModule,
    AuthModule,
    DatabaseModule,
    OrganizationUnitDataModule,
    ShiftModule,
  ],
  providers: [AgreementStatusService, CheckInReadinessAgreementResolver],
})
export class CheckInAgreementModule {}
