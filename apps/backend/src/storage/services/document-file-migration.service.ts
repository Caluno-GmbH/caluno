import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { FilePurpose, FileVisibility } from '../enums';
import type { FileEntity } from '../schemas/file.schema';
import { S3StorageService } from './s3-storage.service';

/**
 * One-shot boot migration: move legacy public DOCUMENT PDFs (IBAN/DOB) under
 * `private/`. Idempotent — only rows with `purpose=document` and
 * `visibility=public`. Delete this service + its module registration once
 * every environment has run it.
 */
@Injectable()
export class DocumentFileMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DocumentFileMigrationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.s3StorageService.isConfigured()) {
      return;
    }

    try {
      const result = await this.migratePublicDocumentFiles();
      if (result.failed > 0) {
        this.logger.error(
          `Document PDF migration finished with ${result.failed} failure(s); ${result.migrated} migrated`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Document PDF migration aborted: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Idempotent: copy every public DOCUMENT object to `private/`, update the
   * row, delete the old public key. Safe to run on every boot.
   */
  async migratePublicDocumentFiles(): Promise<{
    migrated: number;
    failed: number;
  }> {
    if (!this.s3StorageService.isConfigured()) {
      return { migrated: 0, failed: 0 };
    }

    const files = await this.db.query.files.findMany({
      where: {
        purpose: FilePurpose.DOCUMENT,
        visibility: FileVisibility.PUBLIC,
      },
    });

    let migrated = 0;
    let failed = 0;

    for (const file of files) {
      try {
        await this.migrateOnePublicDocument(file);
        migrated += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Failed to migrate document file ${file.id} (${file.storageKey}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (migrated > 0 || failed > 0) {
      this.logger.log(
        `Document file migration: ${migrated} migrated, ${failed} failed (${files.length} public rows)`,
      );
    }

    return { migrated, failed };
  }

  private async migrateOnePublicDocument(file: FileEntity): Promise<void> {
    const oldKey = file.storageKey;
    if (!oldKey.startsWith('public/')) {
      // Row marked public but key already private — just clear the public URL.
      await this.db
        .update(schema.files)
        .set({
          visibility: FileVisibility.PRIVATE,
          publicUrl: null,
        })
        .where(
          and(
            eq(schema.files.id, file.id),
            eq(schema.files.visibility, FileVisibility.PUBLIC),
          ),
        );
      return;
    }

    const newKey = this.buildMigratedPrivateKey(file);
    await this.s3StorageService.copyObject(oldKey, newKey);

    const [updated] = await this.db
      .update(schema.files)
      .set({
        storageKey: newKey,
        visibility: FileVisibility.PRIVATE,
        publicUrl: null,
      })
      .where(
        and(
          eq(schema.files.id, file.id),
          eq(schema.files.visibility, FileVisibility.PUBLIC),
        ),
      )
      .returning({ id: schema.files.id });

    if (!updated) {
      // Another boot won the race; leave the copied object (idempotent next run
      // won't re-select this row) and still try to delete the old public key.
      await this.s3StorageService.deleteObject(oldKey).catch(() => undefined);
      return;
    }

    try {
      await this.s3StorageService.deleteObject(oldKey);
    } catch (error) {
      // Row already private; orphaned public object remains anonymously
      // readable until cleaned up — surface loudly.
      this.logger.error(
        `Migrated document file ${file.id} but failed to delete public object ${oldKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private buildMigratedPrivateKey(file: FileEntity): string {
    const orgSegment = file.organizationUnitId ?? 'global';
    const basename = file.storageKey.split('/').pop() ?? file.filename;
    return `private/${orgSegment}/${file.uploadedByUserId}/${basename}`;
  }
}
