import type {
  GetPublicEventsByOrganizationUnitQuery,
  GetPublicOrganizationUnitQuery,
  GetPublicOrganizationUnitWithRequiredFormsQuery,
  GetPublicShiftsByOrganizationUnitQuery,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export type RawPublicOrganizationUnit =
  GetPublicOrganizationUnitQuery['publicOrganizationUnit'];
export type RawPublicOrganizationUnitWithRequiredForms =
  GetPublicOrganizationUnitWithRequiredFormsQuery['publicOrganizationUnit'];
export type RawPublicOrgEvent =
  GetPublicEventsByOrganizationUnitQuery['publicEventsByOrganizationUnit'][number];
export type RawPublicOrgShift =
  GetPublicShiftsByOrganizationUnitQuery['publicShiftsByOrganizationUnit'][number];

export class PublicOrganizationUnitRepository extends BaseRepository {
  async findById(id: string): Promise<RawPublicOrganizationUnit> {
    const data = await this.sdk.GetPublicOrganizationUnit({ id });
    return data.publicOrganizationUnit;
  }

  /** Anonymous-safe org unit + required forms (field resolvers are public). */
  async findByIdWithRequiredForms(
    id: string,
  ): Promise<RawPublicOrganizationUnitWithRequiredForms> {
    const data = await this.sdk.GetPublicOrganizationUnitWithRequiredForms({
      id,
    });
    return data.publicOrganizationUnit;
  }

  async findEvents(organizationUnitId: string): Promise<RawPublicOrgEvent[]> {
    const data = await this.sdk.GetPublicEventsByOrganizationUnit({
      organizationUnitId,
    });
    return data.publicEventsByOrganizationUnit;
  }

  async findIndividualShifts(
    organizationUnitId: string,
  ): Promise<RawPublicOrgShift[]> {
    const data = await this.sdk.GetPublicShiftsByOrganizationUnit({
      organizationUnitId,
    });
    return data.publicShiftsByOrganizationUnit;
  }
}
