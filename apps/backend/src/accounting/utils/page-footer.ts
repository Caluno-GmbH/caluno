export type PageFooter = {
  enabled: boolean;
  text: string;
};

export const PAGE_FOOTER_FONT_SIZE = 8;
export const PAGE_FOOTER_LINE_GAP = 1;
export const PAGE_FOOTER_LINE_HEIGHT =
  PAGE_FOOTER_FONT_SIZE + PAGE_FOOTER_LINE_GAP;

const GAP_ABOVE = 10;

export function resolvePageFooter(body: {
  pageFooter?: { enabled?: boolean; text?: string } | null;
}): PageFooter {
  return {
    enabled: body.pageFooter?.enabled === true,
    text: body.pageFooter?.text ?? '',
  };
}

/** The PDF footer holds at most this many printed lines; the rest is cut. */
export const PAGE_FOOTER_MAX_LINES = 3;
/**
 * One printed footer line as pdfkit steps it: Helvetica's line height at 8pt
 * (9.248) plus the line gap, rounded up.
 */
export const PAGE_FOOTER_TEXT_LINE_HEIGHT = 10.25;
export const PAGE_FOOTER_TEXT_HEIGHT =
  PAGE_FOOTER_MAX_LINES * PAGE_FOOTER_TEXT_LINE_HEIGHT;

/** The footer text as typed, or empty when off. Trailing blank lines are dropped. */
export function pageFooterText(footer: PageFooter): string {
  if (!footer.enabled) return '';
  return footer.text.replace(/\r\n/g, '\n').trimEnd();
}

/**
 * Never zero: the page number is always present. Any footer text gets the
 * full three-line block, since its wrapped height is unknown up front.
 */
export function pageFooterHeight(footer: PageFooter): number {
  const textBlock =
    pageFooterText(footer) === ''
      ? 0
      : PAGE_FOOTER_LINE_HEIGHT + PAGE_FOOTER_TEXT_HEIGHT;
  return GAP_ABOVE + PAGE_FOOTER_LINE_HEIGHT + textBlock;
}

export function pageNumberLabel(
  page: number | string,
  total: number | string,
): string {
  return `Seite ${page} von ${total}`;
}
