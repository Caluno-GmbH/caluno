import { describe, expect, it } from 'bun:test';
import { pageFooterTextLines, pageNumberLabel } from './template-body.types';

describe('page footer helpers (preview side)', () => {
  it('returns nothing when disabled or absent', () => {
    expect(pageFooterTextLines(undefined)).toEqual([]);
    expect(pageFooterTextLines({ enabled: false, text: 'BSM' })).toEqual([]);
  });

  it('keeps one line per typed line', () => {
    expect(
      pageFooterTextLines({ enabled: true, text: 'BSM gGmbH\nMusterstr. 1' }),
    ).toEqual(['BSM gGmbH', 'Musterstr. 1']);
  });

  it('normalises CRLF and ignores trailing blank lines', () => {
    expect(pageFooterTextLines({ enabled: true, text: 'A\r\nB\n\n' })).toEqual([
      'A',
      'B',
    ]);
  });

  // Pins the wording against the duplicate in apps/backend.
  it('labels pages as the PDF does', () => {
    expect(pageNumberLabel(1, 3)).toBe('Seite 1 von 3');
  });

  it('fills the same format with placeholders for the unpaginated preview', () => {
    expect(pageNumberLabel('x', 'y')).toBe('Seite x von y');
  });
});
