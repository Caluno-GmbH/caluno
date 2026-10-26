import type { Database } from '../../database/database.module';
import type { RequirementFormEntity } from '../../database/schema';
import type { RequiredFormTargetType } from '../enums';

export type RequiredFormRef = {
  form: RequirementFormEntity;
  order: number;
};

export interface RequiredFormTargetStrategy {
  readonly targetType: RequiredFormTargetType;
  resolveOrganizationUnitId(targetId: string): Promise<string>;
  getRequiredForms(targetId: string): Promise<RequiredFormRef[]>;
  setRequiredForms(
    targetId: string,
    formIds: string[],
    userId?: string,
  ): Promise<RequiredFormRef[]>;
  /**
   * Tx-friendly write used by EventService / ShiftService.
   * ORGANIZATION_UNIT has no apply path — undefined there.
   */
  applyRequiredForms?(
    targetId: string,
    organizationId: string,
    formIds: string[],
    tx?: Database,
    userId?: string,
  ): Promise<void>;
}
