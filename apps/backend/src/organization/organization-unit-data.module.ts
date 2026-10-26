import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OrganizationUnitDataService } from './organization-unit-data.service';
import { TenantScopeService } from './tenant-scope.service';

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationUnitDataService, TenantScopeService],
  exports: [OrganizationUnitDataService, TenantScopeService],
})
export class OrganizationUnitDataModule {}
