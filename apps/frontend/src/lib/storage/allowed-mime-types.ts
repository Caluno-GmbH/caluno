import type { UploadPurpose } from './upload-file';

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

export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',');
export const DOCUMENT_ACCEPT = DOCUMENT_PREVIEW_MIME_TYPES.join(',');

const DOCUMENT_PURPOSES = new Set<UploadPurpose>([
  'requirement_document',
  'form_document',
]);

const IMAGE_PURPOSES = new Set<UploadPurpose>([
  'org_logo',
  'organization_logo',
  'event_image',
  'shift_image',
  'profile_picture',
]);

export function isDocumentPurpose(purpose: UploadPurpose): boolean {
  return DOCUMENT_PURPOSES.has(purpose);
}

export function getAcceptForPurpose(
  purpose: UploadPurpose,
): string | undefined {
  if (DOCUMENT_PURPOSES.has(purpose)) {
    return DOCUMENT_ACCEPT;
  }

  if (IMAGE_PURPOSES.has(purpose)) {
    return IMAGE_ACCEPT;
  }

  return undefined;
}

export function isMimeTypeAllowedForPurpose(
  purpose: UploadPurpose,
  mimeType: string,
): boolean {
  if (DOCUMENT_PURPOSES.has(purpose)) {
    return DOCUMENT_PREVIEW_MIME_TYPES.includes(
      mimeType as (typeof DOCUMENT_PREVIEW_MIME_TYPES)[number],
    );
  }

  if (IMAGE_PURPOSES.has(purpose)) {
    return IMAGE_MIME_TYPES.includes(
      mimeType as (typeof IMAGE_MIME_TYPES)[number],
    );
  }

  return false;
}
