/**
 * Calibration of the security checks for this repo.
 *
 * Tenant model (verified in code, see AGENTS.md):
 * - The active tenant comes from the client: header `x-organization-unit-id`
 *   (apps/backend/src/app.module.ts GraphQL context, PermissionGuard for REST).
 * - PermissionGuard verifies membership ONLY when the handler has
 *   @Permissions(...); without it the guard returns true and
 *   organizationUnitId is unverified client input.
 * - The guard reads metadata from the handler only: a class-level
 *   @Permissions would be silently ignored.
 */
import * as path from 'node:path';

/** Repo root: packages/security/src -> ../../.. */
export const repoRoot = path.resolve(
  process.env.REPO_ROOT ?? path.join(import.meta.dir, '..', '..', '..'),
);

export const config = {
  /** Analysed sources, relative to the repo root. */
  include: ['apps/backend/src/**/*.ts'],
  /** Path fragments excluded: tests, dev data, migrations, build output. */
  exclude: [
    '.spec.ts',
    '.test.ts',
    '.e2e-spec.ts',
    '/node_modules/',
    '/dist/',
    '/database/fixtures',
    '/database/seed',
    '/migrations/',
    '/drizzle/',
  ],

  transport: {
    resolverClass: ['Resolver'],
    controllerClass: ['Controller'],
    graphqlOps: ['Query', 'Mutation', 'Subscription', 'ResolveField'],
    restOps: [
      'Get',
      'Post',
      'Put',
      'Patch',
      'Delete',
      'Options',
      'Head',
      'All',
    ],
    /** Reachable without a session. */
    publicMarkers: ['AllowAnonymous', 'OptionalAuth', 'Public'],
    /** Decorators that make PermissionGuard check membership + permissions. */
    permissionDecorators: ['Permissions'],
  },

  tenantContext: {
    /** GraphQL context property carrying the client-chosen tenant. */
    contextProperty: 'organizationUnitId',
    header: 'x-organization-unit-id',
    contextParamDecorators: ['Context'],
    headerParamDecorators: ['Headers', 'Req', 'Request'],
  },

  /** Columns that make a table tenant-scoped (invariant B check). */
  tenantFields: ['organizationUnitId', 'organizationId'],

  tenantQueries: {
    /** Where the Drizzle table definitions live. */
    schemaGlobs: ['apps/backend/src/**/*.schema.ts'],
    /** Calls that prove the loaded resource belongs to the caller's tenant. */
    scopeHelpers: ['assertResourceInScope', 'assertOrganizationInScope'],
    /**
     * Comment that exempts the next statement, with a mandatory reason:
     * `// tenant-scope-ok: <why this cannot cross tenants>`
     */
    exemptionMarker: 'tenant-scope-ok:',
  },
};

export function isExcluded(filePath: string): boolean {
  const p = filePath.split('\\').join('/');
  return config.exclude.some((e) => p.includes(e));
}
