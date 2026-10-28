import { describe, expect, it } from 'bun:test';
import {
  PAGE_FOOTER_WARN_LENGTH,
  pageFooterMayBeCut,
  pageFooterTextLines,
  pageNumberLabel,
} from './template-body.types';

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

describe('pageFooterMayBeCut', () => {
  const on = (text: string) => ({ enabled: true, text });

  it('is three full sample lines long', () => {
    expect(PAGE_FOOTER_WARN_LENGTH).toBe(417);
  });

  it('accepts three typed lines within the length', () => {
    expect(pageFooterMayBeCut(on('A\nB\nC'))).toBe(false);
    expect(pageFooterMayBeCut(on('x'.repeat(PAGE_FOOTER_WARN_LENGTH)))).toBe(
      false,
    );
  });

  it('warns past three typed lines, counting blank lines between them', () => {
    expect(pageFooterMayBeCut(on('A\nB\nC\nD'))).toBe(true);
    expect(pageFooterMayBeCut(on('A\n\nB\nC'))).toBe(true);
  });

  it('warns past the length', () => {
    expect(
      pageFooterMayBeCut(on('x'.repeat(PAGE_FOOTER_WARN_LENGTH + 1))),
    ).toBe(true);
  });

  it('ignores trailing whitespace and blank lines', () => {
    expect(pageFooterMayBeCut(on('A\nB\nC\n\n\n'))).toBe(false);
    expect(
      pageFooterMayBeCut(on(`${'x'.repeat(PAGE_FOOTER_WARN_LENGTH)}   \n`)),
    ).toBe(false);
  });

  it('never warns when the footer is off', () => {
    expect(pageFooterMayBeCut(undefined)).toBe(false);
    expect(pageFooterMayBeCut({ enabled: false, text: 'A\nB\nC\nD' })).toBe(
      false,
    );
  });
});
