import type { AcceptTermsInput } from '../../generated/base-types';
import type {
  AcceptTermsMutation,
  TermsStatusQuery,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export class TermsRepository extends BaseRepository {
  async getStatus(): Promise<TermsStatusQuery['termsStatus']> {
    const data = await this.sdk.TermsStatus();
    return data.termsStatus;
  }

  async accept(
    input: AcceptTermsInput,
  ): Promise<AcceptTermsMutation['acceptTerms']> {
    const data = await this.sdk.AcceptTerms({ input });
    return data.acceptTerms;
  }
}
