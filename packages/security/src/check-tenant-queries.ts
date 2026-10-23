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
  collectTenantTables,
  findUnscopedTenantQueries,
} from './tenant-queries.js';

const relpath = (abs: string) =>
  path.relative(repoRoot, abs).split(path.sep).join('/');

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});
const schemaFiles = config.tenantQueries.schemaGlobs.flatMap((glob) =>
  project.addSourceFilesAtPaths(path.join(repoRoot, glob)),
);
const tenantTables = collectTenantTables(schemaFiles, config.tenantFields);

for (const glob of config.include) {
  project.addSourceFilesAtPaths(path.join(repoRoot, glob));
}

const opts = { ...config.tenantQueries, tenantFields: config.tenantFields };
const findings = project
  .getSourceFiles()
  .filter((sf) => !isExcluded(sf.getFilePath()))
  .filter((sf) => !schemaFiles.includes(sf))
  .flatMap((sf) =>
    findUnscopedTenantQueries(
      sf,
      tenantTables,
      opts,
      config.tenantContext.contextProperty,
      relpath,
    ),
  )
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const inTenantResolver = findings.filter((f) => f.inTenantResolver).length;
const byTable: Record<string, number> = {};
for (const f of findings) byTable[f.table] = (byTable[f.table] ?? 0) + 1;

const summary = {
  tenantTables: tenantTables.size,
  findings: findings.length,
  inTenantResolver,
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
    `(${inTenantResolver} directly in resolvers that read the client tenant). ` +
    `Fix with TenantScopeService, or exempt with "// ${config.tenantQueries.exemptionMarker} <reason>".\n`,
);
