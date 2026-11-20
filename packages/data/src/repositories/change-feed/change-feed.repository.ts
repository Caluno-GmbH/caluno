import type { ChangesSinceQuery } from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export class ChangeFeedRepository extends BaseRepository {
  async changesSince(
    cursor: string | null,
  ): Promise<ChangesSinceQuery['changesSince']> {
    const data = await this.sdk.ChangesSince({ cursor });
    return data.changesSince;
  }
}
