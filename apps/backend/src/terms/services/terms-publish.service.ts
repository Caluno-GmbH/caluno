import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
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

const TERMS_PUBLISH_LOCK_KEY = 874213001;

@Injectable()
export class TermsPublishService {
  private readonly logger = new Logger(TermsPublishService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly termsService: TermsService,
    private readonly notifier: TermsNotificationService,
  ) {}

  /**
   * Run a publish pass under a Postgres advisory lock so only one instance
   * broadcasts a version at a time (concurrent boots must not double-send).
   * The lock is session-scoped on a dedicated connection, so it releases
   * automatically if the process dies — a crashed run is retried on the next
   * boot (a version with `notification_sent_at IS NULL` is re-selected, and
   * users already recorded are skipped).
   */
  private async withPublishLock<T>(run: () => Promise<T>): Promise<T | null> {
    const pool = (this.db as unknown as { $client: Pool }).$client;
    const client = await pool.connect();
    let locked = false;
    try {
      const result = await client.query<{ locked: boolean }>(
        'select pg_try_advisory_lock($1) as locked',
        [TERMS_PUBLISH_LOCK_KEY],
      );
      locked = result.rows[0]?.locked === true;
      if (!locked) {
        this.logger.log('another terms publisher holds the lock; skipping');
        return null;
      }
      return await run();
    } finally {
      if (locked) {
        try {
          await client.query('select pg_advisory_unlock($1)', [
            TERMS_PUBLISH_LOCK_KEY,
          ]);
          client.release();
        } catch {
          client.release(true);
        }
      } else {
        client.release();
      }
    }
  }

  async publishPendingVersions(): Promise<TermsPublishSummary> {
    const result = await this.withPublishLock(() =>
      this.doPublishPendingVersions(),
    );
    return result ?? { published: [], notified: [] };
  }

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

  private async doPublishPendingVersions(): Promise<TermsPublishSummary> {
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
