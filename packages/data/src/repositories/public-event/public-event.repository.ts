import { isNotFoundDataError } from '../../errors/data-error';
import type {
  GetPublicEventQuery,
  JoinEventMutation,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export type RawPublicEvent = GetPublicEventQuery['publicEvent'];

export class PublicEventRepository extends BaseRepository {
  async findById(id: string): Promise<RawPublicEvent | null> {
    try {
      const data = await this.sdk.GetPublicEvent({ id });
      return data.publicEvent;
    } catch (error) {
      if (isNotFoundDataError(error)) return null;
      throw error;
    }
  }

  async join(eventId: string): Promise<JoinEventMutation['joinEvent']> {
    const data = await this.sdk.JoinEvent({ eventId });
    return data.joinEvent;
  }
}
