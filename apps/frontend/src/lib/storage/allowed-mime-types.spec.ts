import { describe, expect, it } from 'bun:test';
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_PREVIEW_MIME_TYPES,
  getAcceptForPurpose,
  isMimeTypeAllowedForPurpose,
} from './allowed-mime-types';

describe('allowed-mime-types', () => {
  it('rejects PDF for image upload purposes', () => {
    expect(isMimeTypeAllowedForPurpose('org_logo', 'application/pdf')).toBe(
      false,
    );
    expect(isMimeTypeAllowedForPurpose('event_image', 'application/pdf')).toBe(
      false,
    );
    expect(
      isMimeTypeAllowedForPurpose('profile_picture', 'application/pdf'),
    ).toBe(false);
  });

  it('allows images for image upload purposes', () => {
    expect(isMimeTypeAllowedForPurpose('shift_image', 'image/png')).toBe(true);
  });

  it('allows previewable types for document upload purposes', () => {
    for (const mimeType of DOCUMENT_PREVIEW_MIME_TYPES) {
      expect(
        isMimeTypeAllowedForPurpose('requirement_document', mimeType),
      ).toBe(true);
      expect(isMimeTypeAllowedForPurpose('form_document', mimeType)).toBe(true);
    }
  });

  it('rejects non-previewable types for document upload purposes', () => {
    expect(
      isMimeTypeAllowedForPurpose(
        'form_document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(false);
    expect(
      isMimeTypeAllowedForPurpose('requirement_document', 'image/heic'),
    ).toBe(false);
    expect(isMimeTypeAllowedForPurpose('form_document', 'image/svg+xml')).toBe(
      false,
    );
  });

  it('restricts the file picker for document upload purposes', () => {
    expect(getAcceptForPurpose('requirement_document')).toBe(DOCUMENT_ACCEPT);
    expect(getAcceptForPurpose('form_document')).toBe(DOCUMENT_ACCEPT);
  });
});
