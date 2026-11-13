import { FilePurpose } from '../enums';

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

/** MIME types browsers can safely render in an iframe (PDF + raster images). */
export const DOCUMENT_PREVIEW_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export interface PurposeValidationRule {
  visibility: 'private' | 'public';
  maxByteSize: number;
  /** Empty = any MIME type. Non-empty = allow-list only. */
  allowedMimeTypes: readonly string[];
  requiredPermission: string;
  requiresOrganizationUnitId: boolean;
  /** Only FileService.saveGeneratedFile may create it; never a client presign. */
  serverGeneratedOnly?: boolean;
}

export const PURPOSE_VALIDATION_RULES: Record<
  FilePurpose,
  PurposeValidationRule
> = {
  [FilePurpose.REQUIREMENT_DOCUMENT]: {
    visibility: 'private',
    maxByteSize: 10 * 1024 * 1024,
    allowedMimeTypes: DOCUMENT_PREVIEW_MIME_TYPES,
    requiredPermission: 'org:view',
    requiresOrganizationUnitId: true,
  },
  // Server-generated documents (rendered contract/invoice PDFs) — uploaded
  // via FileService.saveGeneratedFile, never through the presigned path.
  // Private: PDFs carry IBAN/BIC/DOB/address; download only via short-lived
  // presigned GET after volunteer-or-accounting:manage authz.
  [FilePurpose.DOCUMENT]: {
    visibility: 'private',
    maxByteSize: 25 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
    requiredPermission: 'org:view',
    requiresOrganizationUnitId: true,
  },
  // Server-generated CSV exports (who exported which rows) — private, written
  // only through FileService.saveGeneratedFile, downloaded via a short-lived
  // presigned GET after export-permission authz.
  [FilePurpose.EXPORT]: {
    visibility: 'private',
    maxByteSize: 25 * 1024 * 1024,
    allowedMimeTypes: ['text/csv'],
    requiredPermission: 'org:view',
    requiresOrganizationUnitId: true,
    serverGeneratedOnly: true,
  },
  [FilePurpose.FORM_DOCUMENT]: {
    visibility: 'public',
    maxByteSize: 10 * 1024 * 1024,
    allowedMimeTypes: DOCUMENT_PREVIEW_MIME_TYPES,
    requiredPermission: 'requirement-profile:edit',
    requiresOrganizationUnitId: true,
  },
  [FilePurpose.ORG_LOGO]: {
    visibility: 'public',
    maxByteSize: 2 * 1024 * 1024,
    allowedMimeTypes: IMAGE_MIME_TYPES,
    requiredPermission: 'org:edit',
    requiresOrganizationUnitId: true,
  },
  [FilePurpose.ORGANIZATION_LOGO]: {
    visibility: 'public',
    maxByteSize: 2 * 1024 * 1024,
    allowedMimeTypes: IMAGE_MIME_TYPES,
    requiredPermission: 'org:edit',
    requiresOrganizationUnitId: false,
  },
  [FilePurpose.EVENT_IMAGE]: {
    visibility: 'public',
    maxByteSize: 2 * 1024 * 1024,
    allowedMimeTypes: IMAGE_MIME_TYPES,
    requiredPermission: 'shift:edit',
    requiresOrganizationUnitId: true,
  },
  [FilePurpose.SHIFT_IMAGE]: {
    visibility: 'public',
    maxByteSize: 2 * 1024 * 1024,
    allowedMimeTypes: IMAGE_MIME_TYPES,
    requiredPermission: 'shift:edit',
    requiresOrganizationUnitId: true,
  },
  [FilePurpose.PROFILE_PICTURE]: {
    visibility: 'public',
    maxByteSize: 2 * 1024 * 1024,
    allowedMimeTypes: IMAGE_MIME_TYPES,
    requiredPermission: 'org:view',
    requiresOrganizationUnitId: false,
  },
};

export function isMimeTypeAllowed(
  rule: PurposeValidationRule,
  mimeType: string,
): boolean {
  if (rule.allowedMimeTypes.length === 0) {
    return true;
  }

  return rule.allowedMimeTypes.includes(mimeType);
}

export function sanitizeFilename(filename: string): string {
  const baseName = filename.split(/[/\\]/).pop() ?? 'file';
  const sanitized = baseName
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180);

  return sanitized.length > 0 ? sanitized : 'file';
}
