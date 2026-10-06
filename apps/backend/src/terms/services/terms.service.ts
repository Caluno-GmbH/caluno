import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import {
  BadRequestGraphQLError,
  NotFoundGraphQLError,
} from '../../graphql/errors';
import { TermsChangeClass } from '../enums';
import {
  compareVersions,
  listTermsDocuments,
  pickCurrentTermsVersion,
  sha256File,
  type TermsLocale,
  type TermsVersion,
  termsChangeClassForVersion,
} from '../terms-files';

export const TERMS_DIRECTORY = 'TERMS_DIRECTORY';

export interface TermsStatus {
  mustAccept: boolean;
  currentVersion: string | null;
  currentClass: TermsChangeClass | null;
  acceptedVersion: string | null;
  acceptedAt: Date | null;
}

export function computeMustAccept(
  acceptedVersion: string | null | undefined,
  latestMajor: string | null,
): boolean {
  if (!acceptedVersion) {
    return true;
  }
  if (!latestMajor) {
    return false;
  }
  return compareVersions(acceptedVersion, latestMajor) < 0;
}

@Injectable()
export class TermsService {
  private cache?: {
    at: number;
    current: { version: string; class: TermsChangeClass; date: string } | null;
    latestMajor: string | null;
    hasPublished: boolean;
  };

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(TERMS_DIRECTORY) private readonly directory: string,
  ) {}

  private readVersionsFromFiles(): TermsVersion[] {
    return listTermsDocuments(this.directory);
  }

  private async readPublished(): Promise<
    Array<{
      version: string;
      class: TermsChangeClass;
      publishedAt: Date;
      notificationSentAt: Date | null;
    }>
  > {
    const rows = await this.db.select().from(schema.termsVersions);
    return rows.map((row) => ({
      version: row.version,
      class: row.class,
      publishedAt: row.publishedAt,
      notificationSentAt: row.notificationSentAt,
    }));
  }

  private invalidateCache(): void {
    this.cache = undefined;
  }

  async listPublishedVersions() {
    return this.readPublished();
  }

  private latestMajorFrom(
    published: Array<{ version: string; class: TermsChangeClass }>,
  ): string | null {
    const majors = published
      .filter((row) => row.class === TermsChangeClass.MAJOR)
      .map((row) => row.version)
      .sort(compareVersions);
    return majors.at(-1) ?? null;
  }

  async getLatestMajorVersion(): Promise<string | null> {
    return this.latestMajorFrom(await this.readPublished());
  }

  private async getSnapshot(): Promise<{
    current: { version: string; class: TermsChangeClass; date: string } | null;
    latestMajor: string | null;
    hasPublished: boolean;
  }> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < 60_000) {
      return this.cache;
    }

    const published = await this.readPublished();
    const rows = [...published].sort((a, b) =>
      compareVersions(a.version, b.version),
    );
    const currentRow = rows.at(-1);
    const files = this.readVersionsFromFiles();

    let current: {
      version: string;
      class: TermsChangeClass;
      date: string;
    } | null;

    if (currentRow) {
      const file = files.find((doc) => doc.version === currentRow.version);
      current = {
        version: currentRow.version,
        class: currentRow.class,
        date: file?.date ?? currentRow.publishedAt.toISOString().slice(0, 10),
      };
    } else {
      const file = pickCurrentTermsVersion(files);
      current = file
        ? {
            version: file.version,
            class: termsChangeClassForVersion(file.version),
            date: file.date,
          }
        : null;
    }

    if (published.length === 0) {
      this.cache = undefined;
      return { current, latestMajor: null, hasPublished: false };
    }

    this.cache = {
      at: now,
      current,
      latestMajor: this.latestMajorFrom(published),
      hasPublished: true,
    };
    return this.cache;
  }

  async getCurrentVersion(): Promise<{
    version: string;
    class: TermsChangeClass;
    date: string;
  } | null> {
    return (await this.getSnapshot()).current;
  }

  resolveDocument(version: string, locale: TermsLocale): TermsVersion {
    const file = this.readVersionsFromFiles().find(
      (doc) => doc.version === version && doc.locale === locale,
    );
    if (!file) {
      throw new BadRequestGraphQLError(
        `Terms document not found for version ${version} (${locale})`,
      );
    }
    return file;
  }

  async mustAccept(
    acceptedVersion: string | null | undefined,
  ): Promise<boolean> {
    const snapshot = await this.getSnapshot();
    if (!snapshot.hasPublished) {
      return false;
    }
    return computeMustAccept(acceptedVersion, snapshot.latestMajor);
  }

  async getStatusForUser(userId: string): Promise<TermsStatus> {
    const user = await this.db.query.users.findFirst({
      where: { id: userId },
    });
    const current = await this.getCurrentVersion();
    const acceptedVersion = user?.termsVersion ?? null;
    return {
      mustAccept: await this.mustAccept(acceptedVersion),
      currentVersion: current?.version ?? null,
      currentClass: current?.class ?? null,
      acceptedVersion,
      acceptedAt: user?.termsAcceptedAt ?? null,
    };
  }

  async accept(input: {
    userId: string;
    version: string;
    language: TermsLocale;
  }): Promise<void> {
    const current = await this.getCurrentVersion();
    if (!current) {
      throw new BadRequestGraphQLError('No published terms version');
    }
    if (compareVersions(input.version, current.version) !== 0) {
      throw new BadRequestGraphQLError(
        'The accepted version is not the current version',
      );
    }

    const user = await this.db.query.users.findFirst({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundGraphQLError('User not found');
    }
    if (user.termsVersion === current.version) {
      const existing = await this.db.query.termsAcceptances.findFirst({
        where: { userId: input.userId, version: current.version },
      });
      if (existing) {
        return;
      }
    }

    const document = this.resolveDocument(current.version, input.language);
    const documentHash = sha256File(document.path);

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ termsVersion: current.version, termsAcceptedAt: new Date() })
        .where(eq(schema.users.id, input.userId));

      await tx.insert(schema.termsAcceptances).values({
        userId: input.userId,
        version: current.version,
        class: current.class,
        language: input.language,
        documentFilename: document.filename,
        documentHash,
      });
    });
  }

  async recordSignupAcceptance(userId: string): Promise<void> {
    const user = await this.db.query.users.findFirst({
      where: { id: userId },
    });
    if (!user?.termsVersion) {
      return;
    }
    const locale: TermsLocale = user.locale === 'en' ? 'en' : 'de';
    const document = this.resolveDocument(user.termsVersion, locale);
    await this.db.insert(schema.termsAcceptances).values({
      userId,
      version: user.termsVersion,
      class: termsChangeClassForVersion(user.termsVersion),
      language: locale,
      documentFilename: document.filename,
      documentHash: sha256File(document.path),
    });
  }

  async publishVersion(
    version: string,
  ): Promise<{ version: string; class: TermsChangeClass }> {
    const classForVersion = termsChangeClassForVersion(version);
    await this.db
      .insert(schema.termsVersions)
      .values({ version, class: classForVersion })
      .onConflictDoNothing({ target: schema.termsVersions.version });
    this.invalidateCache();
    return { version, class: classForVersion };
  }

  async markNotified(version: string): Promise<void> {
    await this.db
      .update(schema.termsVersions)
      .set({ notificationSentAt: new Date() })
      .where(eq(schema.termsVersions.version, version));
  }
}
