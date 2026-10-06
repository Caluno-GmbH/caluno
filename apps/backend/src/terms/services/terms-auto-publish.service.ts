import { Injectable, Logger } from '@nestjs/common';
import { TermsPublishService } from './terms-publish.service';

@Injectable()
export class TermsAutoPublishService {
  private readonly logger = new Logger(TermsAutoPublishService.name);

  constructor(private readonly publisher: TermsPublishService) {}

  async runIfEnabled(): Promise<void> {
    if (process.env.TERMS_AUTO_PUBLISH !== 'true') {
      return;
    }

    try {
      const { published, notified } =
        await this.publisher.publishPendingVersions();
      if (published.length > 0 || notified.length > 0) {
        this.logger.log(
          `terms auto-publish: published [${published
            .map((entry) => entry.version)
            .join(', ')}], notified [${notified
            .map((entry) => entry.version)
            .join(', ')}]`,
        );
      }
    } catch (error) {
      this.logger.error(
        `terms auto-publish failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
