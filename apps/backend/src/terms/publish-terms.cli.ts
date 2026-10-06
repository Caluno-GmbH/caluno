import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TermsChangeClass } from './enums';
import { TermsService } from './services/terms.service';
import { TermsNotificationService } from './services/terms-notification.service';
import {
  compareVersions,
  defaultTermsDirectory,
  listTermsDocuments,
} from './terms-files';

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

  // Validate every new version before publishing or notifying any of them, so a
  // document set missing a locale cannot leave a half-published batch.
  for (const version of newVersions) {
    const locales = new Set(byVersion.get(version)?.map((f) => f.locale));
    if (!locales.has('en') || !locales.has('de')) {
      throw new Error(`Terms ${version} is missing an en or de document`);
    }
  }

  for (const version of newVersions) {
    await termsService.publishVersion(version);
  }

  // Publishing leaves notification_sent_at null; re-reading means a version
  // written by an interrupted run is picked up again, so a crash between
  // publish and notify is recoverable without a new document set.
  const toNotify = (await termsService.listPublishedVersions())
    .filter((row) => row.notificationSentAt === null)
    .sort((a, b) => compareVersions(a.version, b.version));

  for (const row of toNotify) {
    await notifier.broadcastForVersion({
      version: row.version,
      class: row.class,
      acceptTermsUrl,
    });
    await termsService.markNotified(row.version);
    console.log(
      `published ${row.version} (${row.class === TermsChangeClass.MAJOR ? 'major' : 'minor'})`,
    );
  }

  if (toNotify.length === 0) {
    console.log('no new terms versions to publish');
  }

  await app.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
