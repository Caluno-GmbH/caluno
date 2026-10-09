import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNACCEPTED_TERMS_KEY = 'allowUnacceptedTerms';

export const AllowUnacceptedTerms = () =>
  SetMetadata(ALLOW_UNACCEPTED_TERMS_KEY, true);
