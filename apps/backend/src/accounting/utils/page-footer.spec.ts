import { describe, expect, it } from 'bun:test';
import {
  PAGE_FOOTER_LINE_HEIGHT,
  pageFooterHeight,
  pageFooterLines,
  pageNumberLabel,
  resolvePageFooter,
} from './page-footer';

describe('page footer', () => {
  it('is disabled when the template has no pageFooter', () => {
    const footer = resolvePageFooter({});
    expect(footer.enabled).toBe(false);
    expect(pageFooterLines(footer)).toEqual([]);
  });

  it('still reserves the page-number line when the footer is off', () => {
    expect(pageFooterHeight(resolvePageFooter({}))).toBeGreaterThan(0);
  });

  it('adds a blank line between the page number and the footer text', () => {
    const none = resolvePageFooter({});
    const one = resolvePageFooter({ pageFooter: { enabled: true, text: 'A' } });
    // page number only -> + blank line + one text line
    expect(pageFooterHeight(one) - pageFooterHeight(none)).toBe(
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
    expect(pageFooterLines(footer)).toEqual([
      'BSM gGmbH',
      'Musterstr. 1',
      '20357 Hamburg',
    ]);
  });

  it('normalises CRLF and ignores trailing blank lines', () => {
    const footer = resolvePageFooter({
      pageFooter: { enabled: true, text: 'A\r\nB\n\n' },
    });
    expect(pageFooterLines(footer)).toEqual(['A', 'B']);
  });

  it('reserves room for the page number even with no text', () => {
    const footer = resolvePageFooter({
      pageFooter: { enabled: true, text: '' },
    });
    expect(pageFooterLines(footer)).toEqual([]);
    expect(pageFooterHeight(footer)).toBeGreaterThan(0);
  });

  it('grows the reserved height with each line', () => {
    const one = resolvePageFooter({ pageFooter: { enabled: true, text: 'A' } });
    const three = resolvePageFooter({
      pageFooter: { enabled: true, text: 'A\nB\nC' },
    });
    expect(pageFooterHeight(three)).toBeGreaterThan(pageFooterHeight(one));
  });

  // The builder preview has its own copy in packages/data; the backend does not
  // depend on @repo/data, so this pins the wording the two must agree on.
  it('labels pages as the preview does', () => {
    expect(pageNumberLabel(1, 3)).toBe('Seite 1 von 3');
    // The preview has no pages to count, so it fills the same format with
    // placeholders — one format string, two callers.
    expect(pageNumberLabel('x', 'y')).toBe('Seite x von y');
  });
});
