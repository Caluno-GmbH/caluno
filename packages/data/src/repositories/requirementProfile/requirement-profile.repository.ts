import type { GetAdminUserProfileQuery } from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export class RequirementProfileRepository extends BaseRepository {
  async getAdminUserProfile(
    userId: string,
  ): Promise<GetAdminUserProfileQuery['user']> {
    const data = await this.sdk.GetAdminUserProfile({ userId });
    return data.user ?? null;
  }
}
