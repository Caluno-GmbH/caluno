import type { CreateRequirementProfileSubmissionInput } from '../../generated/base-types';
import type {
  CreateRequirementProfileSubmissionMutation,
  GetAdminUserProfileQuery,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export class RequirementProfileRepository extends BaseRepository {
  async createSubmission(
    input: CreateRequirementProfileSubmissionInput,
  ): Promise<
    CreateRequirementProfileSubmissionMutation['createRequirementProfileSubmission']
  > {
    const data = await this.sdk.CreateRequirementProfileSubmission({ input });
    return data.createRequirementProfileSubmission;
  }

  async getAdminUserProfile(
    userId: string,
  ): Promise<GetAdminUserProfileQuery['user']> {
    const data = await this.sdk.GetAdminUserProfile({ userId });
    return data.user ?? null;
  }
}
