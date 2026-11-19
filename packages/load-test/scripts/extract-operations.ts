/**
 * Writes every GraphQL document the frontend uses (from @repo/data codegen) to
 * `.data/operations.json`, keyed by operation name, so k6 sends exactly the
 * queries the app sends.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as generated from '../../data/src/generated/graphql';

const DOCUMENT_SUFFIX = 'Document';

const operations = Object.fromEntries(
  Object.entries(generated)
    .filter(
      (entry): entry is [string, string] =>
        entry[0].endsWith(DOCUMENT_SUFFIX) && typeof entry[1] === 'string',
    )
    .map(([name, document]) => [
      name.slice(0, -DOCUMENT_SUFFIX.length),
      document,
    ]),
);

const outDir = resolve(import.meta.dir, '../.data');
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'operations.json'), JSON.stringify(operations));
console.log(`Extracted ${Object.keys(operations).length} GraphQL operations`);
