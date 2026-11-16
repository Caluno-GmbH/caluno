import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../auth/constants';
import { FilePurpose, FileStatus, FileVisibility } from '../enums';
import { FileService } from './file.service';

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

function buildService(
  overrides: {
    file?: FileRow;
    contract?: {
      volunteerId: string;
      organizationUnitId: string | null;
    } | null;
    invoice?: {
      volunteerId: string;
      organizationUnitId: string | null;
    } | null;
    hasPermission?: (userId: string, unitId: string, keys: string[]) => boolean;
  } = {},
) {
  const file: FileRow = overrides.file ?? {
    id: 'file-1',
    storageKey: 'private/unit-1/user-uploader/abc-doc.pdf',
    visibility: FileVisibility.PRIVATE,
    purpose: FilePurpose.DOCUMENT,
    status: FileStatus.UPLOADED,
    publicUrl: null,
    organizationUnitId: 'unit-1',
    uploadedByUserId: 'user-uploader',
    filename: 'abc-doc.pdf',
  };

  const s3 = {
    isConfigured: () => true,
    createPresignedDownloadUrl: mock(() =>
      Promise.resolve('https://signed.example/get'),
    ),
    getObjectBytes: mock(() => Promise.resolve(Buffer.from('%PDF'))),
    buildPublicUrl: (key: string) => `https://public.example/${key}`,
  };

  const authService = {
    hasRequiredPermissions: mock(
      (userId: string, unitId: string, keys: string[]) =>
        Promise.resolve(
          overrides.hasPermission?.(userId, unitId, keys) ?? false,
        ),
    ),
  };

  const db = {
    query: {
      files: {
        findFirst: () => Promise.resolve(file),
      },
      contracts: {
        findFirst: () =>
          Promise.resolve(
            overrides.contract === undefined
              ? {
                  volunteerId: 'volunteer-1',
                  organizationUnitId: 'unit-1',
                }
              : overrides.contract,
          ),
      },
      invoices: {
        findFirst: () =>
          Promise.resolve(
            overrides.invoice === undefined ? null : overrides.invoice,
          ),
      },
    },
  };

  const service = new FileService(
    db as never,
    s3 as never,
    authService as never,
    { capture: () => undefined } as never,
  );

  return { service, s3, authService, file };
}

describe('FileService document download authz', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('lets the volunteer resolve a short-lived download URL', async () => {
    const { service, s3 } = buildService();

    const url = await service.resolveDocumentDownloadUrl('volunteer-1', {
      fileId: 'file-1',
      volunteerId: 'volunteer-1',
      organizationUnitId: 'unit-1',
    });

    expect(url).toBe('https://signed.example/get');
    expect(s3.createPresignedDownloadUrl).toHaveBeenCalledWith(
      'private/unit-1/user-uploader/abc-doc.pdf',
    );
  });

  it('lets an accounting manager resolve a download URL', async () => {
    const { service } = buildService({
      hasPermission: (_userId, unitId, keys) =>
        unitId === 'unit-1' && keys.includes(PERMISSIONS.ACCOUNTING_MANAGE),
    });

    const url = await service.resolveDocumentDownloadUrl('manager-1', {
      fileId: 'file-1',
      volunteerId: 'volunteer-1',
      organizationUnitId: 'unit-1',
    });

    expect(url).toBe('https://signed.example/get');
  });

  it('returns null for a stranger', async () => {
    const { service } = buildService();

    const url = await service.resolveDocumentDownloadUrl('stranger', {
      fileId: 'file-1',
      volunteerId: 'volunteer-1',
      organizationUnitId: 'unit-1',
    });

    expect(url).toBeNull();
  });

  it('does not treat the uploader alone as authorized for DOCUMENT', async () => {
    const { service } = buildService();

    const url = await service.resolveDocumentDownloadUrl('user-uploader', {
      fileId: 'file-1',
      volunteerId: 'volunteer-1',
      organizationUnitId: 'unit-1',
    });

    expect(url).toBeNull();
  });

  it('presignDownload for DOCUMENT never returns a permanent public URL', async () => {
    const { service, s3 } = buildService({
      file: {
        id: 'file-1',
        storageKey: 'public/unit-1/document/abc-doc.pdf',
        visibility: FileVisibility.PUBLIC,
        purpose: FilePurpose.DOCUMENT,
        status: FileStatus.UPLOADED,
        publicUrl: 'https://public.example/public/unit-1/document/abc-doc.pdf',
        organizationUnitId: 'unit-1',
        uploadedByUserId: 'volunteer-1',
        filename: 'abc-doc.pdf',
      },
    });

    const result = await service.presignDownload('volunteer-1', 'file-1');

    expect(result.downloadUrl).toBe('https://signed.example/get');
    expect(s3.createPresignedDownloadUrl).toHaveBeenCalled();
  });

  it('presignDownload rejects a stranger for DOCUMENT', async () => {
    const { service } = buildService();

    await expect(
      service.presignDownload('stranger', 'file-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('presignDownload for EXPORT allows a caller with an export permission', async () => {
    const { service } = buildService({
      file: {
        id: 'file-1',
        storageKey: 'private/unit-1/user-uploader/export.csv',
        visibility: FileVisibility.PRIVATE,
        purpose: FilePurpose.EXPORT,
        status: FileStatus.UPLOADED,
        publicUrl: null,
        organizationUnitId: 'unit-1',
        uploadedByUserId: 'user-uploader',
        filename: 'export.csv',
      },
      hasPermission: (_userId, _unitId, keys) =>
        keys.includes(PERMISSIONS.SHIFT_EDIT),
    });

    const result = await service.presignDownload('actor-1', 'file-1', 'unit-1');

    expect(result.downloadUrl).toBe('https://signed.example/get');
  });

  it('presignDownload for EXPORT rejects a caller without export permissions', async () => {
    const { service } = buildService({
      file: {
        id: 'file-1',
        storageKey: 'private/unit-1/user-uploader/export.csv',
        visibility: FileVisibility.PRIVATE,
        purpose: FilePurpose.EXPORT,
        status: FileStatus.UPLOADED,
        publicUrl: null,
        organizationUnitId: 'unit-1',
        uploadedByUserId: 'user-uploader',
        filename: 'export.csv',
      },
      hasPermission: () => false,
    });

    await expect(
      service.presignDownload('actor-1', 'file-1', 'unit-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('presignDownload for EXPORT rejects a caller from another unit', async () => {
    const { service } = buildService({
      file: {
        id: 'file-1',
        storageKey: 'private/unit-1/user-uploader/export.csv',
        visibility: FileVisibility.PRIVATE,
        purpose: FilePurpose.EXPORT,
        status: FileStatus.UPLOADED,
        publicUrl: null,
        organizationUnitId: 'unit-1',
        uploadedByUserId: 'user-uploader',
        filename: 'export.csv',
      },
      hasPermission: () => true,
    });

    await expect(
      service.presignDownload('actor-1', 'file-1', 'unit-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
