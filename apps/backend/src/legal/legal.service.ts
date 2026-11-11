import { createReadStream } from 'node:fs';
import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import {
  currentPrivacyPolicyVersion,
  type PrivacyPolicyLocale,
  resolvePrivacyPolicyDocument,
} from './privacy-policy-files';

export const PRIVACY_POLICY_DIRECTORY = 'PRIVACY_POLICY_DIRECTORY';

@Injectable()
export class LegalService {
  constructor(
    @Inject(PRIVACY_POLICY_DIRECTORY)
    private readonly directory: string,
  ) {}

  getCurrentPrivacyNoticeDate(): string {
    return currentPrivacyPolicyVersion(this.directory);
  }

  streamCurrentPrivacyPolicy(locale: PrivacyPolicyLocale): StreamableFile {
    const document = resolvePrivacyPolicyDocument(this.directory, locale);

    return new StreamableFile(createReadStream(document.path), {
      type: 'application/pdf',
      disposition: `inline; filename="${document.filename}"`,
    });
  }
}
