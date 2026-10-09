import { describe, expect, it } from 'bun:test';
import {
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
    expect(pageFooterHeight(footer)).toBe(0);
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
    expect(pageNumberLabel(1, 1)).toBe('Seite 1 von 1');
  });
});
