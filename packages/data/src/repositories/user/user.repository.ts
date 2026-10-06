import type {
  GetMyOrganizationsQuery,
  GetMyPermissionsQuery,
  GetUserQuery,
  UpdateMyAccountSettingsInput,
  UpdateMyAccountSettingsMutation,
  UpdateMyImageInput,
  UpdateMyLocaleMutation,
  UpdateMyProfileInput,
  UpdateMyProfileMutation,
  UserWithProfile,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export class UserRepository extends BaseRepository {
  async getMe(): Promise<UserWithProfile> {
    const data = await this.sdk.GetMe();
    return data.me;
  }

  async findById(id: string): Promise<GetUserQuery['user']> {
    const data = await this.sdk.GetUser({ id });
    return data.user ?? null;
  }

  async getMyPermissions(): Promise<
    NonNullable<GetMyPermissionsQuery['me']['permissions']>
  > {
    const data = await this.sdk.GetMyPermissions();
    return data.me.permissions ?? [];
  }

  async getMyOrganizations(
    options: { limit?: number; offset?: number } = {},
  ): Promise<GetMyOrganizationsQuery['organizations']> {
    const { limit = 10, offset = 0 } = options;
    const data = await this.sdk.GetMyOrganizations({ limit, offset });
    return data.organizations;
  }

  async updateMyLocale(
    locale: string,
  ): Promise<UpdateMyLocaleMutation['updateMyLocale']> {
    const data = await this.sdk.UpdateMyLocale({ locale });
    return data.updateMyLocale;
  }

  async updateMyImage(input: UpdateMyImageInput) {
    const data = await this.sdk.UpdateMyImage({ input });
    return data.updateMyImage;
  }

  async updateMyAccountSettings(
    input: UpdateMyAccountSettingsInput,
  ): Promise<UpdateMyAccountSettingsMutation['updateMyAccountSettings']> {
    const data = await this.sdk.UpdateMyAccountSettings({ input });
    return data.updateMyAccountSettings;
  }

  async updateMyProfile(
    input: UpdateMyProfileInput,
  ): Promise<UpdateMyProfileMutation['updateMyProfile']> {
    const data = await this.sdk.UpdateMyProfile({ input });
    return data.updateMyProfile;
  }

  async unsubscribeFromEmails(): Promise<boolean> {
    const data = await this.sdk.UnsubscribeFromEmails();
    return data.unsubscribeFromEmails;
  }
}
