/**
 * Ground truth of the API surface: every resolver/controller endpoint, via AST.
 * No LLM, no sampling: a method with an operation decorator is listed here.
 *
 * Also checks INVARIANT A (tenant context is verified) on 100% of endpoints:
 * a handler that reads the client-chosen tenant (context.organizationUnitId or
 * the x-organization-unit-id header) without @Permissions never gets its
 * membership checked by PermissionGuard.
 *
 * Usage: bun src/enumerate-surface.ts > out/surface.json
 */
import * as path from 'node:path';
import {
  type ClassDeclaration,
  type MethodDeclaration,
  Project,
  SyntaxKind,
} from 'ts-morph';
import { config, isExcluded, relpath, repoRoot } from './config.js';
import { decoName, tenantContextUse } from './tenant-context.js';

const t = config.transport;

type Flag =
  | 'ANONYMOUS'
  | 'UNVERIFIED-TENANT-CONTEXT'
  | 'CLASS-LEVEL-PERMISSIONS-IGNORED'
  | 'AUTHENTICATED-NO-PERMISSION';

type Endpoint = {
  id: string;
  kind: 'graphql' | 'rest';
  operation: string;
  className: string;
  name: string;
  file: string;
  line: number;
  permissions: string[];
  public: boolean;
  tenantContextUse: string | null;
  flags: Flag[];
};

const decoArgs = (
  node: MethodDeclaration | ClassDeclaration,
  names: string[],
): string[] =>
  node
    .getDecorators()
    .filter((d) => names.includes(decoName(d)))
    .flatMap((d) => {
      const call = d.getExpression().asKind(SyntaxKind.CallExpression);
      return call
        ? call
            .getArguments()
            .map((a) => a.getText().replace(/^PERMISSIONS\./, ''))
        : [];
    });

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});
for (const glob of config.include) {
  project.addSourceFilesAtPaths(path.join(repoRoot, glob));
}

const endpoints: Endpoint[] = [];

for (const sf of project.getSourceFiles()) {
  if (isExcluded(sf.getFilePath())) continue;
  for (const cls of sf.getClasses()) {
    const classDecos = cls.getDecorators().map(decoName);
    const isEntry = classDecos.some(
      (d) => t.resolverClass.includes(d) || t.controllerClass.includes(d),
    );
    if (!isEntry) continue;
    const classPerms = decoArgs(cls, t.permissionDecorators);
    const classPublic = classDecos.some((d) => t.publicMarkers.includes(d));

    for (const m of cls.getMethods()) {
      const decos = m.getDecorators().map(decoName);
      const op = decos.find(
        (d) => t.graphqlOps.includes(d) || t.restOps.includes(d),
      );
      if (!op) continue;

      const permissions = decoArgs(m, t.permissionDecorators);
      const isPublic =
        classPublic || decos.some((d) => t.publicMarkers.includes(d));
      const use = tenantContextUse(m);

      const flags: Flag[] = [];
      if (isPublic) flags.push('ANONYMOUS');
      if (use && permissions.length === 0) {
        flags.push('UNVERIFIED-TENANT-CONTEXT');
      }
      if (classPerms.length > 0) flags.push('CLASS-LEVEL-PERMISSIONS-IGNORED');
      if (!isPublic && permissions.length === 0 && op !== 'ResolveField') {
        flags.push('AUTHENTICATED-NO-PERMISSION');
      }

      const className = cls.getName() ?? '<anon>';
      const file = relpath(sf.getFilePath());
      endpoints.push({
        id: `${file}:${className}.${m.getName()}`,
        kind: t.graphqlOps.includes(op) ? 'graphql' : 'rest',
        operation: op,
        className,
        name: m.getName(),
        file,
        line: m.getStartLineNumber(),
        permissions,
        public: isPublic,
        tenantContextUse: use,
        flags,
      });
    }
  }
}

endpoints.sort((a, b) => a.id.localeCompare(b.id));

const count = (f: Flag) => endpoints.filter((e) => e.flags.includes(f)).length;
const byOperation: Record<string, number> = {};
for (const e of endpoints) {
  byOperation[e.operation] = (byOperation[e.operation] ?? 0) + 1;
}

const summary = {
  total: endpoints.length,
  byOperation,
  anonymous: count('ANONYMOUS'),
  unverifiedTenantContext: count('UNVERIFIED-TENANT-CONTEXT'),
  classLevelPermissionsIgnored: count('CLASS-LEVEL-PERMISSIONS-IGNORED'),
  authenticatedNoPermission: count('AUTHENTICATED-NO-PERMISSION'),
  generatedAt: new Date().toISOString(),
};

process.stdout.write(`${JSON.stringify({ summary, endpoints }, null, 2)}\n`);
process.stderr.write(
  `[surface] ${summary.total} endpoints: ${summary.anonymous} anonymous, ` +
    `${summary.unverifiedTenantContext} read the client tenant WITHOUT @Permissions, ` +
    `${summary.authenticatedNoPermission} authenticated without a permission.\n`,
);
