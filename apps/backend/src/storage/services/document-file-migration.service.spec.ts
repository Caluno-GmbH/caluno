import { describe, expect, it, mock } from 'bun:test';
import { FilePurpose, FileStatus, FileVisibility } from '../enums';
import { DocumentFileMigrationService } from './document-file-migration.service';

type FileRow = {
  id: string;
  storageKey: string;
  visibility: FileVisibility;
  purpose: FilePurpose;
  status: FileStatus;
  publicUrl: string | null;
  organizationUnitId: string | null;
  uploadedByUserId: string;
  filename: string;
};

function buildMigrationService(publicDocuments: FileRow[]) {
  const updatedRows: Array<Record<string, unknown>> = [];
  const s3 = {
    isConfigured: () => true,
    copyObject: mock(() => Promise.resolve()),
    deleteObject: mock(() => Promise.resolve()),
  };

  const db = {
    query: {
      files: {
        findMany: () => Promise.resolve(publicDocuments),
      },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updatedRows.push(values);
          return {
            returning: () =>
              Promise.resolve(
                publicDocuments[0] ? [{ id: publicDocuments[0].id }] : [],
              ),
          };
        },
      }),
    }),
  };

  const service = new DocumentFileMigrationService(db as never, s3 as never);
  return { service, s3, updatedRows };
}

describe('DocumentFileMigrationService.migratePublicDocumentFiles', () => {
  it('copies public DOCUMENT objects to private/, clears publicUrl, deletes old key', async () => {
    const publicFile: FileRow = {
      id: 'file-legacy',
      storageKey: 'public/unit-1/document/uuid-Vereinbarung.pdf',
      visibility: FileVisibility.PUBLIC,
      purpose: FilePurpose.DOCUMENT,
      status: FileStatus.UPLOADED,
      publicUrl:
        'https://public.example/public/unit-1/document/uuid-Vereinbarung.pdf',
      organizationUnitId: 'unit-1',
      uploadedByUserId: 'actor-1',
      filename: 'uuid-Vereinbarung.pdf',
    };

    const { service, s3, updatedRows } = buildMigrationService([publicFile]);

    const result = await service.migratePublicDocumentFiles();

    expect(result).toEqual({ migrated: 1, failed: 0 });
    expect(s3.copyObject).toHaveBeenCalledWith(
      'public/unit-1/document/uuid-Vereinbarung.pdf',
      'private/unit-1/actor-1/uuid-Vereinbarung.pdf',
    );
    expect(updatedRows[0]).toMatchObject({
      storageKey: 'private/unit-1/actor-1/uuid-Vereinbarung.pdf',
      visibility: FileVisibility.PRIVATE,
      publicUrl: null,
    });
    expect(s3.deleteObject).toHaveBeenCalledWith(
      'public/unit-1/document/uuid-Vereinbarung.pdf',
    );
  });

  it('is a no-op when there are no public DOCUMENT rows', async () => {
    const { service, s3 } = buildMigrationService([]);

    const result = await service.migratePublicDocumentFiles();

    expect(result).toEqual({ migrated: 0, failed: 0 });
    expect(s3.copyObject).not.toHaveBeenCalled();
  });
});
