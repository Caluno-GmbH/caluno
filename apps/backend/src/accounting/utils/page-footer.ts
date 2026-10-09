export type PageFooter = {
  enabled: boolean;
  text: string;
};

export const PAGE_FOOTER_FONT_SIZE = 8;
const LINE_GAP = 1;
const GAP_ABOVE = 10;

const LINE_HEIGHT = PAGE_FOOTER_FONT_SIZE + LINE_GAP;

export function resolvePageFooter(body: {
  pageFooter?: { enabled?: boolean; text?: string } | null;
}): PageFooter {
  const raw = body.pageFooter;
  const text = (raw?.text ?? '').replace(/\r\n/g, '\n').trimEnd();
  return { enabled: raw?.enabled === true, text };
}

export function pageFooterLines(footer: PageFooter): string[] {
  if (!footer.enabled || footer.text.length === 0) return [];
  return footer.text.split('\n');
}

/** Vertical space to reserve, including the page-number line above the text. */
export function pageFooterHeight(footer: PageFooter): number {
  if (!footer.enabled) return 0;
  return GAP_ABOVE + (1 + pageFooterLines(footer).length) * LINE_HEIGHT;
}

export function pageNumberLabel(pageIndex: number, pageCount: number): string {
  return `Seite ${pageIndex} von ${pageCount}`;
}

export const PAGE_FOOTER_LINE_HEIGHT = LINE_HEIGHT;
export const PAGE_FOOTER_LINE_GAP = LINE_GAP;
