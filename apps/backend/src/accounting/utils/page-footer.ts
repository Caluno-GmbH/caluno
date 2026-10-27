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
/** A4 (595.28pt) minus 48pt margins on each side. */
export const PAGE_FOOTER_COLUMN_WIDTH = 499.28;

function typedLines(footer: PageFooter): string[] {
  if (!footer.enabled) return [];
  const text = footer.text.replace(/\r\n/g, '\n').trimEnd();
  return text.length === 0 ? [] : text.split('\n');
}

// Duplicated in packages/data (template-body.types.ts) for the preview; keep in sync.
/**
 * Greedy word wrap of one typed line into printed lines. A word wider than
 * `maxWidth` is broken between characters.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const lines: string[] = [];
  let current = '';
  text.split(' ').forEach((token, index) => {
    if (index > 0) {
      const joined = `${current} ${token}`;
      if (measure(joined) <= maxWidth) {
        current = joined;
        return;
      }
      lines.push(current);
      current = '';
    }
    if (measure(token) <= maxWidth) {
      current = token;
      return;
    }
    let chunk = '';
    for (const ch of token) {
      if (chunk !== '' && measure(chunk + ch) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    current = chunk;
  });
  lines.push(current);
  return lines;
}

// Duplicated in packages/data (template-body.types.ts) for the preview; keep in sync.
/**
 * The footer as printed: each typed line wrapped to the column, cut to
 * `PAGE_FOOTER_MAX_LINES` with an ellipsis on the last kept line.
 */
export function clampPageFooterLines(
  footer: PageFooter,
  measure: (s: string) => number,
): string[] {
  const printed = typedLines(footer).flatMap((line) =>
    wrapText(line, PAGE_FOOTER_COLUMN_WIDTH, measure),
  );
  if (printed.length <= PAGE_FOOTER_MAX_LINES) return printed;
  const lines = printed.slice(0, PAGE_FOOTER_MAX_LINES);
  let last = lines[PAGE_FOOTER_MAX_LINES - 1] ?? '';
  while (last !== '' && measure(`${last}…`) > PAGE_FOOTER_COLUMN_WIDTH) {
    last = last.slice(0, -1);
  }
  lines[PAGE_FOOTER_MAX_LINES - 1] = `${last.trimEnd()}…`;
  return lines;
}

/** Never zero: the page number is always present. */
export function pageFooterHeight(lineCount: number): number {
  const textBlock = lineCount > 0 ? 1 + lineCount : 0;
  return GAP_ABOVE + (1 + textBlock) * PAGE_FOOTER_LINE_HEIGHT;
}

export function pageNumberLabel(
  page: number | string,
  total: number | string,
): string {
  return `Seite ${page} von ${total}`;
}
