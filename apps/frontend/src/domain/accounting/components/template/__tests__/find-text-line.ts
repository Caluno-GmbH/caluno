import type { TemplateDocument, TemplateLine } from '../builder-types';

/** Spec helper: the line with this id in any text block, whichever block it lives in. */
export function findTextLine(
  doc: TemplateDocument,
  id: string,
): TemplateLine | undefined {
  for (const block of doc.blocks) {
    if (block.kind !== 'text') continue;
    const line = block.lines.find((l) => l.id === id);
    if (line) return line;
  }
  return undefined;
}
