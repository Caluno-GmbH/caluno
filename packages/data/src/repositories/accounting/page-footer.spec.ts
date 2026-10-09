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

  // Must match apps/backend/src/accounting/utils/page-footer.spec.ts — the two
  // live either side of the app boundary and cannot share an implementation.
  it('labels pages as the PDF does', () => {
    expect(pageNumberLabel(1, 3)).toBe('Seite 1 von 3');
    expect(pageNumberLabel(1, 1)).toBe('Seite 1 von 1');
  });
});
