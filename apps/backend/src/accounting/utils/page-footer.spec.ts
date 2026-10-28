import { describe, expect, it } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  PAGE_FOOTER_FONT_SIZE,
  PAGE_FOOTER_LINE_GAP,
  PAGE_FOOTER_LINE_HEIGHT,
  PAGE_FOOTER_TEXT_HEIGHT,
  PAGE_FOOTER_TEXT_LINE_HEIGHT,
  pageFooterHeight,
  pageFooterText,
  pageNumberLabel,
  resolvePageFooter,
} from './page-footer';

describe('page footer', () => {
  it('is disabled when the template has no pageFooter', () => {
    const footer = resolvePageFooter({});
    expect(footer.enabled).toBe(false);
    expect(pageFooterText(footer)).toBe('');
  });

  it('still reserves the page-number line when the footer is off', () => {
    expect(pageFooterHeight(resolvePageFooter({}))).toBeGreaterThan(0);
  });

  it('reserves a blank line and the full text block for any footer text', () => {
    const none = resolvePageFooter({});
    const one = resolvePageFooter({ pageFooter: { enabled: true, text: 'A' } });
    expect(pageFooterHeight(one) - pageFooterHeight(none)).toBe(
      PAGE_FOOTER_LINE_HEIGHT + PAGE_FOOTER_TEXT_HEIGHT,
    );
  });

  it('normalises CRLF and ignores trailing blank lines', () => {
    const footer = resolvePageFooter({
      pageFooter: { enabled: true, text: 'A\r\nB\n\n' },
    });
    expect(pageFooterText(footer)).toBe('A\nB');
  });

  it('reserves room for the page number even with no text', () => {
    const footer = resolvePageFooter({
      pageFooter: { enabled: true, text: '' },
    });
    expect(pageFooterText(footer)).toBe('');
    expect(pageFooterHeight(footer)).toBe(
      pageFooterHeight(resolvePageFooter({})),
    );
  });

  it('reserves the same height however many lines are typed', () => {
    const one = resolvePageFooter({ pageFooter: { enabled: true, text: 'A' } });
    const five = resolvePageFooter({
      pageFooter: { enabled: true, text: 'A\nB\nC\nD\nE' },
    });
    expect(pageFooterHeight(five)).toBe(pageFooterHeight(one));
  });

  // pdfkit stops at `height`, so the step must cover its real line height.
  it('steps text lines as pdfkit does', () => {
    const pdf = new PDFDocument({ size: 'A4' });
    pdf.font('Helvetica').fontSize(PAGE_FOOTER_FONT_SIZE);
    const step = pdf.currentLineHeight(true) + PAGE_FOOTER_LINE_GAP;
    expect(PAGE_FOOTER_TEXT_LINE_HEIGHT).toBeGreaterThanOrEqual(step);
    expect(PAGE_FOOTER_TEXT_LINE_HEIGHT - step).toBeLessThan(0.01);
  });

  // Pins the wording against the duplicate in packages/data.
  it('labels pages as the preview does', () => {
    expect(pageNumberLabel(1, 3)).toBe('Seite 1 von 3');
    expect(pageNumberLabel('x', 'y')).toBe('Seite x von y');
  });
});
