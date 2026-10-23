/**
 * Invariant B: queries on tenant tables constrained by `id` alone.
 * Rule and limits: see tenant-queries.ts.
 *
 * Reports, never fails on findings (like the other scanners); a crash writes
 * no report, which audit.sh turns into a failed step.
 *
 * Usage: bun src/check-tenant-queries.ts > out/tenant-queries.json
 */
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { config, isExcluded, repoRoot } from './config.js';
import {
  analyzeTenantQueries,
  collectTenantTables,
  type TenantQueryOptions,
} from './tenant-queries.js';

const relpath = (abs: string) =>
  path.relative(repoRoot, abs).split(path.sep).join('/');

const opts: TenantQueryOptions = { ...config.tenantQueries, relpath };

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});
const schemaFiles = config.tenantQueries.schemaGlobs.flatMap((glob) =>
  project.addSourceFilesAtPaths(path.join(repoRoot, glob)),
);
const tenantTables = collectTenantTables(schemaFiles, opts);

for (const glob of config.include) {
  project.addSourceFilesAtPaths(path.join(repoRoot, glob));
}

const files = project
  .getSourceFiles()
  .filter((sf) => !isExcluded(sf.getFilePath()))
  .filter((sf) => !schemaFiles.includes(sf));
const findings = analyzeTenantQueries(files, tenantTables, opts).sort(
  (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
);

const byTable: Record<string, number> = {};
for (const f of findings) byTable[f.table] = (byTable[f.table] ?? 0) + 1;
const reachedFromHandler = findings.filter(
  (f) => f.reachedFrom.length > 0,
).length;
const readsTenantContext = findings.filter((f) => f.readsTenantContext).length;

const summary = {
  tenantTables: tenantTables.size,
  findings: findings.length,
  reachedFromHandler,
  readsTenantContext,
  byTable: Object.fromEntries(
    Object.entries(byTable).sort(([, a], [, b]) => b - a),
  ),
  generatedAt: new Date().toISOString(),
};

process.stdout.write(
  `${JSON.stringify(
    { summary, tenantTables: [...tenantTables].sort(), findings },
    null,
    2,
  )}\n`,
);
process.stderr.write(
  `[tenant-queries] ${summary.findings} id-only queries on ${summary.tenantTables} tenant tables ` +
    `(${reachedFromHandler} run directly by a resolver/controller handler, ` +
    `${readsTenantContext} of them by one that reads the client tenant). ` +
    `Fix with TenantScopeService, or exempt with "// ${opts.exemptionMarker} <reason>".\n`,
);
