import { describe, expect, it } from 'bun:test';
import {
  BUNDLE_SUBJECT_PLACEHOLDERS,
  MAX_BUNDLE_SUBJECT_LENGTH,
  unknownSubjectPlaceholders,
} from './index';

describe('bundle email subject contract', () => {
  it('lists the placeholders both apps render', () => {
    expect(BUNDLE_SUBJECT_PLACEHOLDERS).toEqual([
      'volunteer',
      'period',
      'type',
    ]);
    expect(MAX_BUNDLE_SUBJECT_LENGTH).toBe(200);
  });

  it('reports only unknown placeholders', () => {
    expect(
      unknownSubjectPlaceholders('Abrechnung {volunteer} – {period}'),
    ).toEqual([]);
    expect(unknownSubjectPlaceholders('{volunteer} {iban}')).toEqual(['iban']);
  });
});
