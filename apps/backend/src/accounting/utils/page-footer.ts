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

// Kept in step with `pageFooterTextLines` / `pageNumberLabel` in
// packages/data, which the builder preview uses. The backend does not depend
// on @repo/data, so the two are verified against each other by spec instead.
export function pageFooterLines(footer: PageFooter): string[] {
  if (!footer.enabled) return [];
  const text = footer.text.replace(/\r\n/g, '\n').trimEnd();
  return text.length === 0 ? [] : text.split('\n');
}

/** Vertical space to reserve, including the page-number line above the text. */
export function pageFooterHeight(footer: PageFooter): number {
  if (!footer.enabled) return 0;
  return (
    GAP_ABOVE + (1 + pageFooterLines(footer).length) * PAGE_FOOTER_LINE_HEIGHT
  );
}

export function pageNumberLabel(page: number, total: number): string {
  return `Seite ${page} von ${total}`;
}
