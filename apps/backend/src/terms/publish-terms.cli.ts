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

  for (const version of newVersions) {
    const locales = new Set(byVersion.get(version)?.map((f) => f.locale));
    if (!locales.has('en') || !locales.has('de')) {
      throw new Error(`Terms ${version} is missing an en or de document`);
    }
    const { class: changeClass } = await termsService.publishVersion(version);
    await notifier.broadcastForVersion({
      version,
      class: changeClass,
      acceptTermsUrl,
    });
    await termsService.markNotified(version);
    console.log(
      `published ${version} (${changeClass === TermsChangeClass.MAJOR ? 'major' : 'minor'})`,
    );
  }

  if (newVersions.length === 0) {
    console.log('no new terms versions to publish');
  }

  await app.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
