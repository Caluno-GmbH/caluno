import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TermsChangeClass } from './enums';
import { TermsPublishService } from './services/terms-publish.service';

const classLabel = (value: TermsChangeClass): string =>
  value === TermsChangeClass.MAJOR ? 'major' : 'minor';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const { published, notified } = await app
      .get(TermsPublishService)
      .publishPendingVersions();

    for (const entry of published) {
      console.log(`published ${entry.version} (${classLabel(entry.class)})`);
    }

    for (const entry of notified) {
      console.log(
        `${entry.recovered ? 're-notified already-published' : 'notified'} ${
          entry.version
        } (${classLabel(entry.class)})`,
      );
    }

    if (published.length === 0 && notified.length === 0) {
      console.log('no new terms versions to publish');
    }
  } finally {
    await app.close();
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
