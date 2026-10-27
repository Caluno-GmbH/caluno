import { describe, expect, it } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  clampPageFooterLines,
  PAGE_FOOTER_COLUMN_WIDTH,
  PAGE_FOOTER_LINE_HEIGHT,
  pageFooterHeight,
  pageNumberLabel,
  resolvePageFooter,
} from './page-footer';

const SAMPLE =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium';
const IBAN = 'DE89370400440532013000';
const on = (text: string) => ({ enabled: true, text });
const measure = (s: string) => s.length;

describe('page footer', () => {
  it('is disabled when the template has no pageFooter', () => {
    const footer = resolvePageFooter({});
    expect(footer.enabled).toBe(false);
    expect(clampPageFooterLines(footer, measure)).toEqual([]);
  });

  it('still reserves the page-number line when the footer is off', () => {
    expect(pageFooterHeight(0)).toBeGreaterThan(0);
  });

  it('adds a blank line between the page number and the footer text', () => {
    expect(pageFooterHeight(1) - pageFooterHeight(0)).toBe(
      2 * PAGE_FOOTER_LINE_HEIGHT,
    );
  });

  it('keeps one line per typed line', () => {
    const footer = resolvePageFooter({
      pageFooter: {
        enabled: true,
        text: 'BSM gGmbH\nMusterstr. 1\n20357 Hamburg',
      },
    });
    expect(clampPageFooterLines(footer, measure)).toEqual([
      'BSM gGmbH',
      'Musterstr. 1',
      '20357 Hamburg',
    ]);
  });

  it('normalises CRLF and ignores trailing blank lines', () => {
    const footer = resolvePageFooter({
      pageFooter: { enabled: true, text: 'A\r\nB\n\n' },
    });
    expect(clampPageFooterLines(footer, measure)).toEqual(['A', 'B']);
  });

  it('clamps a fourth typed line and ends the third with an ellipsis', () => {
    expect(clampPageFooterLines(on('A\nB\nC\nD'), measure)).toEqual([
      'A',
      'B',
      'C…',
    ]);
  });

  it('reserves room for the page number even with no text', () => {
    expect(
      clampPageFooterLines(
        resolvePageFooter({ pageFooter: { enabled: true, text: '' } }),
        measure,
      ),
    ).toEqual([]);
    expect(pageFooterHeight(0)).toBeGreaterThan(0);
  });

  it('reserves the same height as before for no and three lines', () => {
    expect(pageFooterHeight(0)).toBe(19);
    expect(pageFooterHeight(3)).toBe(55);
  });

  it('grows the reserved height with each line', () => {
    expect(pageFooterHeight(3)).toBeGreaterThan(pageFooterHeight(1));
  });

  // The expected lines are what clampPageFooter in packages/data produces.
  describe('measures with pdfkit like the preview table', () => {
    const pdf = new PDFDocument({ size: 'A4' });
    pdf.font('Helvetica').fontSize(8);
    const printed = (text: string) =>
      clampPageFooterLines(on(text), (s) => pdf.widthOfString(s));

    it('fits the reference sample on one line', () => {
      expect(printed(SAMPLE)).toEqual([SAMPLE]);
    });

    it('clamps the sample repeated four times', () => {
      expect(printed(`${SAMPLE} ${SAMPLE} ${SAMPLE} ${SAMPLE}`)).toEqual([
        SAMPLE,
        SAMPLE,
        `${SAMPLE}…`,
      ]);
    });

    it('wraps capitals that a character count would let through', () => {
      expect(printed('ABCDEFGHIJ '.repeat(12).trim())).toEqual([
        'ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ',
        'ABCDEFGHIJ ABCDEFGHIJ ABCDEFGHIJ',
      ]);
    });

    it('breaks a word longer than the column', () => {
      expect(printed(IBAN.repeat(8))).toEqual([
        'DE89370400440532013000DE89370400440532013000DE89370400440532013000DE89370400440532013000DE8937040044053201300',
        '0DE89370400440532013000DE89370400440532013000DE89370400440532013000',
      ]);
    });

    it('keeps an address with umlauts on one line', () => {
      const address =
        'Diakonisches Werk Hamburg e.V. · Königstraße 54 · 22767 Hamburg · Amtsgericht Hamburg VR 12345 · Geschäftsführung: Maria Müller';
      expect(printed(address)).toEqual([address]);
    });

    it('never prints a line wider than the column', () => {
      for (const line of printed(IBAN.repeat(20))) {
        expect(pdf.widthOfString(line)).toBeLessThanOrEqual(
          PAGE_FOOTER_COLUMN_WIDTH,
        );
      }
    });
  });

  // Pins the wording against the duplicate in packages/data.
  it('labels pages as the preview does', () => {
    expect(pageNumberLabel(1, 3)).toBe('Seite 1 von 3');
    expect(pageNumberLabel('x', 'y')).toBe('Seite x von y');
  });
});
