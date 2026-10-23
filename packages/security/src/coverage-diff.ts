/**
 * Makes "did the agent review everything?" mechanical. Compares the ground
 * truth (out/surface.json) with the coverage manifest an audit agent emits.
 * Every surface id missing from the manifest, or marked SKIPPED, is a gap;
 * every manifest id not in the surface was invented.
 *
 * Usage: bun src/coverage-diff.ts out/surface.json out/manifest.jsonl
 * Manifest: JSON array or JSONL of { id, status, note }.
 * Exit 1 below COVERAGE_THRESHOLD (default 100) or on invented ids.
 */
import * as fs from 'node:fs';

type Entry = { id: string; status: string; note?: string };

const [surfacePath, manifestPath = 'out/manifest.jsonl'] =
  process.argv.slice(2);
if (!surfacePath) {
  console.error('Usage: bun src/coverage-diff.ts <surface.json> [manifest]');
  process.exit(2);
}
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(2);
}

const threshold = Number(process.env.COVERAGE_THRESHOLD ?? '100');
const surface = JSON.parse(fs.readFileSync(surfacePath, 'utf8'));
const ids: string[] = (surface.endpoints ?? []).map(
  (e: { id: string }) => e.id,
);

const raw = fs.readFileSync(manifestPath, 'utf8').trim();
let entries: Entry[];
try {
  const parsed = JSON.parse(raw);
  entries = Array.isArray(parsed) ? parsed : (parsed.manifest ?? []);
} catch {
  entries = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Entry);
}

const byId = new Map(entries.map((e) => [e.id, e]));
const surfaceSet = new Set(ids);
const missing = ids.filter((id) => !byId.has(id));
const skipped = ids.filter((id) => byId.get(id)?.status === 'SKIPPED');
const reviewed = ids.length - missing.length - skipped.length;
const invented = entries.map((e) => e.id).filter((id) => !surfaceSet.has(id));
const pct = ids.length ? (reviewed / ids.length) * 100 : 100;
const pass = pct >= threshold && invented.length === 0;

console.log(
  JSON.stringify(
    {
      totalEndpoints: ids.length,
      reviewed,
      skipped: skipped.length,
      missingFromManifest: missing.length,
      inventedIds: invented.length,
      coveragePct: Number(pct.toFixed(1)),
      threshold,
      pass,
      details: {
        missingFromManifest: missing,
        skipped: skipped.map((id) => ({ id, note: byId.get(id)?.note })),
        inventedIds: invented,
      },
    },
    null,
    2,
  ),
);
console.error(
  `[coverage] ${pct.toFixed(1)}% reviewed (${reviewed}/${ids.length}), ` +
    `${missing.length} never touched, ${skipped.length} skipped, ` +
    `${invented.length} invented ids: ${pass ? 'PASS' : 'FAIL'}`,
);
process.exit(pass ? 0 : 1);
