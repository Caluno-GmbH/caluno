import type { TemplateBlock } from './builder-types';

/**
 * Editor section headings are interface copy: they follow the coordinator's language, so they
 * are looked up here instead of being rendered from the block's own `title`.
 *
 * `title` is document content — persisted German legal text that the backend prints into the
 * PDF (see `template-body.types.ts`'s "documents are always German, never i18n'd") and that the
 * document preview renders as-is. Rendering it in the editor leaked German into an otherwise
 * translated panel (VOLI-1336); the editor now owns its own translated heading.
 *
 * `stundennachweis` is deliberately mapped to the same German string in both catalogs: it is a
 * term from German tax law that appears on the German document, so it stays German everywhere
 * rather than being translated for the interface. That choice is intentional, not an omission.
 */
const BLOCK_HEADING_KEYS: Record<string, string> = {
  'persoenliche-daten': 'blockHeadings.persoenlicheDaten',
  stundennachweis: 'blockHeadings.stundennachweis',
  'jahresdeckel-hinweis': 'blockHeadings.jahresdeckelHinweis',
};

/** Translation key for a block's editor heading, or `undefined` to fall back to the block's own German `title`. */
export function blockHeadingKey(block: TemplateBlock): string | undefined {
  return BLOCK_HEADING_KEYS[block.id];
}
