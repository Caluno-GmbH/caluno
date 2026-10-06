import { Injectable } from '@nestjs/common';
import { TermsChangeClass } from '../enums';
import {
  compareVersions,
  defaultTermsDirectory,
  isTermsPlaceholderDocument,
  listTermsDocuments,
  TERMS_PLACEHOLDER_MARKER,
  type TermsVersion,
} from '../terms-files';
import { TermsService } from './terms.service';
import { TermsNotificationService } from './terms-notification.service';

export interface TermsPublishSummary {
  published: Array<{ version: string; class: TermsChangeClass }>;
  notified: Array<{
    version: string;
    class: TermsChangeClass;
    recovered: boolean;
  }>;
}

const PLACEHOLDER_ALLOWED = process.env.TERMS_ALLOW_PLACEHOLDER === '1';

@Injectable()
export class TermsPublishService {
  constructor(
    private readonly termsService: TermsService,
    private readonly notifier: TermsNotificationService,
  ) {}

  acceptTermsUrl(): string {
    const base =
      process.env.WEB_URL ?? process.env.APP_URL ?? 'https://app.caluno.org';
    return `${base.replace(/\/+$/, '')}/accept-terms`;
  }

  private assertPublishableDocuments(
    version: string,
    docs: TermsVersion[],
  ): void {
    for (const doc of docs) {
      if (!PLACEHOLDER_ALLOWED && isTermsPlaceholderDocument(doc.path)) {
        throw new Error(
          `Refusing to publish terms ${version}: placeholder document ${doc.filename} still contains ${TERMS_PLACEHOLDER_MARKER}`,
        );
      }
    }
  }

  async publishPendingVersions(): Promise<TermsPublishSummary> {
    const files = listTermsDocuments(defaultTermsDirectory());
    const byVersion = new Map<string, TermsVersion[]>();
    for (const file of files) {
      byVersion.set(file.version, [
        ...(byVersion.get(file.version) ?? []),
        file,
      ]);
    }

    const published = await this.termsService.listPublishedVersions();
    const publishedVersions = new Set(published.map((row) => row.version));
    const newVersions = [...byVersion.keys()]
      .filter((version) => !publishedVersions.has(version))
      .sort(compareVersions);

    for (const version of newVersions) {
      const docs = byVersion.get(version) ?? [];
      const locales = new Set(docs.map((file) => file.locale));
      if (!locales.has('en') || !locales.has('de')) {
        throw new Error(`Terms ${version} is missing an en or de document`);
      }
      this.assertPublishableDocuments(version, docs);
    }

    const publishedOut: TermsPublishSummary['published'] = [];
    for (const version of newVersions) {
      const { class: changeClass } =
        await this.termsService.publishVersion(version);
      publishedOut.push({ version, class: changeClass });
    }

    const newlyPublished = new Set(newVersions);
    const toNotify = (await this.termsService.listPublishedVersions())
      .filter((row) => row.notificationSentAt === null)
      .sort((a, b) => compareVersions(a.version, b.version));

    for (const row of toNotify) {
      this.assertPublishableDocuments(
        row.version,
        byVersion.get(row.version) ?? [],
      );
    }

    const notified: TermsPublishSummary['notified'] = [];
    for (const row of toNotify) {
      await this.notifier.broadcastForVersion({
        version: row.version,
        class: row.class,
        acceptTermsUrl: this.acceptTermsUrl(),
      });
      await this.termsService.markNotified(row.version);
      notified.push({
        version: row.version,
        class: row.class,
        recovered: !newlyPublished.has(row.version),
      });
    }

    return { published: publishedOut, notified };
  }
}
