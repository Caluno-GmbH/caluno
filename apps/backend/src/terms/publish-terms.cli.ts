import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TermsChangeClass } from './enums';
import { TermsService } from './services/terms.service';
import { TermsNotificationService } from './services/terms-notification.service';
import {
  compareVersions,
  defaultTermsDirectory,
  isTermsPlaceholderDocument,
  listTermsDocuments,
  TERMS_PLACEHOLDER_MARKER,
  type TermsVersion,
  termsChangeClassForVersion,
} from './terms-files';

const PLACEHOLDER_ALLOWED = process.env.TERMS_ALLOW_PLACEHOLDER === '1';

function assertPublishableDocuments(
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

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const termsService = app.get(TermsService);
  const notifier = app.get(TermsNotificationService);

  const files = listTermsDocuments(defaultTermsDirectory());
  const byVersion = new Map<string, typeof files>();
  for (const file of files) {
    byVersion.set(file.version, [...(byVersion.get(file.version) ?? []), file]);
  }

  const published = await termsService.listPublishedVersions();
  const publishedVersions = new Set(published.map((row) => row.version));
  const acceptTermsUrl = `${process.env.APP_URL ?? 'https://app.caluno.org'}/accept-terms`;

  const newVersions = [...byVersion.keys()]
    .filter((version) => !publishedVersions.has(version))
    .sort(compareVersions);

  for (const version of newVersions) {
    const docs = byVersion.get(version) ?? [];
    const locales = new Set(docs.map((f) => f.locale));
    if (!locales.has('en') || !locales.has('de')) {
      throw new Error(`Terms ${version} is missing an en or de document`);
    }
    assertPublishableDocuments(version, docs);
  }

  const classLabel = (value: TermsChangeClass): string =>
    value === TermsChangeClass.MAJOR ? 'major' : 'minor';

  for (const version of newVersions) {
    await termsService.publishVersion(version);
    console.log(
      `published ${version} (${classLabel(termsChangeClassForVersion(version))})`,
    );
  }

  const newlyPublished = new Set(newVersions);
  const toNotify = (await termsService.listPublishedVersions())
    .filter((row) => row.notificationSentAt === null)
    .sort((a, b) => compareVersions(a.version, b.version));

  for (const row of toNotify) {
    assertPublishableDocuments(row.version, byVersion.get(row.version) ?? []);
  }

  for (const row of toNotify) {
    await notifier.broadcastForVersion({
      version: row.version,
      class: row.class,
      acceptTermsUrl,
    });
    await termsService.markNotified(row.version);
    if (!newlyPublished.has(row.version)) {
      console.log(
        `re-notified already-published ${row.version} (${classLabel(row.class)})`,
      );
    }
  }

  if (newVersions.length === 0 && toNotify.length === 0) {
    console.log('no new terms versions to publish');
  }

  await app.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
