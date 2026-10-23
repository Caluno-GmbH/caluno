import { FilePurpose } from '../enums';
import {
  DOCUMENT_PREVIEW_MIME_TYPES,
  isMimeTypeAllowed,
  PURPOSE_VALIDATION_RULES,
} from './purpose-validation';

const IMAGE_PURPOSES = [
  FilePurpose.ORG_LOGO,
  FilePurpose.ORGANIZATION_LOGO,
  FilePurpose.EVENT_IMAGE,
  FilePurpose.SHIFT_IMAGE,
  FilePurpose.PROFILE_PICTURE,
] as const;

const DOCUMENT_PURPOSES = [
  FilePurpose.REQUIREMENT_DOCUMENT,
  FilePurpose.FORM_DOCUMENT,
] as const;

describe('purpose-validation document MIME restrictions', () => {
  it.each(DOCUMENT_PURPOSES)(
    'allows previewable MIME types for %s',
    (purpose) => {
      const rule = PURPOSE_VALIDATION_RULES[purpose];
      for (const mimeType of DOCUMENT_PREVIEW_MIME_TYPES) {
        expect(isMimeTypeAllowed(rule, mimeType)).toBe(true);
      }
    },
  );

  it.each(DOCUMENT_PURPOSES)(
    'rejects non-previewable MIME types for %s',
    (purpose) => {
      const rule = PURPOSE_VALIDATION_RULES[purpose];
      expect(
        isMimeTypeAllowed(
          rule,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).toBe(false);
      expect(
        isMimeTypeAllowed(
          rule,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
      ).toBe(false);
      expect(isMimeTypeAllowed(rule, 'image/heic')).toBe(false);
      expect(isMimeTypeAllowed(rule, 'image/svg+xml')).toBe(false);
      expect(isMimeTypeAllowed(rule, 'text/plain')).toBe(false);
    },
  );
});

describe('purpose-validation image MIME restrictions', () => {
  it.each(IMAGE_PURPOSES)('rejects non-image MIME types for %s', (purpose) => {
    const rule = PURPOSE_VALIDATION_RULES[purpose];
    expect(isMimeTypeAllowed(rule, 'application/pdf')).toBe(false);
    expect(isMimeTypeAllowed(rule, 'text/plain')).toBe(false);
  });

  it.each(IMAGE_PURPOSES)(
    'allows common image MIME types for %s',
    (purpose) => {
      const rule = PURPOSE_VALIDATION_RULES[purpose];
      expect(isMimeTypeAllowed(rule, 'image/png')).toBe(true);
      expect(isMimeTypeAllowed(rule, 'image/jpeg')).toBe(true);
    },
  );
});
