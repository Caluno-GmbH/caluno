import { describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { HELVETICA_WIDTHS } from './helvetica-widths';
import {
  clampPageFooter,
  measureHelvetica,
  PAGE_FOOTER_COLUMN_WIDTH,
  pageFooterTextLines,
  pageNumberLabel,
  wrapText,
} from './template-body.types';

// pdfkit is a dependency of apps/backend only.
const PDFDocument = createRequire(
  resolve(__dirname, '../../../../../apps/backend/package.json'),
)('pdfkit');

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

const SAMPLE =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium';
const on = (text: string) => ({ enabled: true, text });
const measure8 = (s: string) => measureHelvetica(s, 8);

describe('clampPageFooter', () => {
  it('fits the reference sample on one printed line', () => {
    expect(clampPageFooter(on(SAMPLE))).toEqual({
      lines: [SAMPLE],
      clamped: false,
    });
  });

  it('wraps capitals that a character count would let through', () => {
    const caps = 'ABCDEFGHIJ '.repeat(12).trim(); // 131 chars, ~760pt
    expect(clampPageFooter(on(caps)).lines.length).toBe(2);
  });

  it('does not clamp exactly three lines', () => {
    expect(clampPageFooter(on('A\nB\nC'))).toEqual({
      lines: ['A', 'B', 'C'],
      clamped: false,
    });
  });

  it('clamps a fourth typed line and ends the third with an ellipsis', () => {
    const r = clampPageFooter(on('A\nB\nC\nD'));
    expect(r.clamped).toBe(true);
    expect(r.lines).toEqual(['A', 'B', 'C…']);
  });

  it('clamps wrapped text so the ellipsis still fits the column', () => {
    const r = clampPageFooter(on(`${SAMPLE} ${SAMPLE} ${SAMPLE} ${SAMPLE}`));
    expect(r.lines.length).toBe(3);
    expect(r.lines[2]?.endsWith('…')).toBe(true);
    expect(measure8(r.lines[2] ?? '')).toBeLessThanOrEqual(
      PAGE_FOOTER_COLUMN_WIDTH,
    );
  });

  it('counts a blank line between text lines', () => {
    expect(clampPageFooter(on('A\n\nB')).lines).toEqual(['A', '', 'B']);
  });

  it('ignores trailing blank lines and CRLF', () => {
    expect(clampPageFooter(on('A\r\nB\r\nC\r\n\r\n'))).toEqual({
      lines: ['A', 'B', 'C'],
      clamped: false,
    });
  });

  it('returns nothing when disabled', () => {
    expect(clampPageFooter({ enabled: false, text: 'A' })).toEqual({
      lines: [],
      clamped: false,
    });
  });
});

describe('wrapText', () => {
  it('breaks a word longer than the column', () => {
    const iban = 'DE89370400440532013000'.repeat(8);
    const lines = wrapText(iban, PAGE_FOOTER_COLUMN_WIDTH, measure8);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines)
      expect(measure8(l)).toBeLessThanOrEqual(PAGE_FOOTER_COLUMN_WIDTH);
    expect(lines.join('')).toBe(iban);
  });

  it('returns one empty line for empty input', () => {
    expect(wrapText('', PAGE_FOOTER_COLUMN_WIDTH, measure8)).toEqual(['']);
  });
});

describe('measureHelvetica', () => {
  it('measures German characters', () => {
    expect(measureHelvetica('Straße · Köln €', 8)).toBeGreaterThan(0);
  });

  it('counts unknown characters as zero width, like pdfkit', () => {
    expect(measureHelvetica('漢', 1000)).toBe(0);
  });

  it('reads the generated width table', () => {
    expect(HELVETICA_WIDTHS.a).toBe(556);
    expect(HELVETICA_WIDTHS[' ']).toBe(278);
  });

  // The table must agree with what the backend renders.
  it('matches pdfkit, kerning included', () => {
    const pdf = new PDFDocument();
    pdf.font('Helvetica').fontSize(8);
    for (const text of [
      SAMPLE,
      'AVATAR Tower',
      'Yo, We… Te Ta Vo',
      'Straße · Köln €',
      '漢ł',
      'BSM gGmbH · Musterstraße 1 · 20095 Hamburg',
    ]) {
      expect(measure8(text)).toBeCloseTo(pdf.widthOfString(text), 6);
    }
  });
});
