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

// Duplicated in packages/data for the preview; the backend cannot import it.
export function pageFooterLines(footer: PageFooter): string[] {
  if (!footer.enabled) return [];
  const text = footer.text.replace(/\r\n/g, '\n').trimEnd();
  return text.length === 0 ? [] : text.split('\n');
}

/** Never zero: the page number is always present. */
export function pageFooterHeight(footer: PageFooter): number {
  const lines = pageFooterLines(footer);
  const textBlock = lines.length > 0 ? 1 + lines.length : 0;
  return GAP_ABOVE + (1 + textBlock) * PAGE_FOOTER_LINE_HEIGHT;
}

export function pageNumberLabel(
  page: number | string,
  total: number | string,
): string {
  return `Seite ${page} von ${total}`;
}
