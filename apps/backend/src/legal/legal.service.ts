import { createReadStream } from 'node:fs';
import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { resolvePrivacyPolicyDocument } from './privacy-policy-files';

export const PRIVACY_POLICY_DIRECTORY = 'PRIVACY_POLICY_DIRECTORY';

@Injectable()
export class LegalService {
  constructor(
    @Inject(PRIVACY_POLICY_DIRECTORY)
    private readonly directory: string,
  ) {}

  getCurrentPrivacyNoticeDate(): string {
    return resolvePrivacyPolicyDocument(this.directory).version;
  }

  streamCurrentPrivacyPolicy(): StreamableFile {
    const document = resolvePrivacyPolicyDocument(this.directory);

    return new StreamableFile(createReadStream(document.path), {
      type: 'application/pdf',
      disposition: `inline; filename="${document.filename}"`,
    });
  }
}
