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

/** Repo-relative path with forward slashes, as reports print it. */
export const relpath = (abs: string): string =>
  path.relative(repoRoot, abs).split(path.sep).join('/');

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
    '/database/fixture',
    '/database/demo-',
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

  /** Invariant B rule (tenant-queries.ts). */
  tenantQueries: {
    /** Columns that make a table tenant-scoped. */
    tenantFields: ['organizationUnitId', 'organizationId'],
    /** Where the Drizzle table definitions live. */
    schemaGlobs: ['apps/backend/src/**/*.schema.ts'],
    /** Tenant tables without a tenant column: the tenant root itself. */
    tenantRootTables: ['organizations'],
    /** Drizzle table factories: `snakeCase.table(...)`, `pgTable(...)`. */
    tableFactories: ['table', 'pgTable'],
    /** Relational query methods: `db.query.<table>.<method>(...)`. */
    queryMethods: ['findFirst', 'findMany'],
    /** Relation names that scope a relational `where` like a tenant column. */
    tenantRelations: ['organizationUnit', 'organization'],
    /**
     * Type-name suffix of a loaded DB row (`ShiftEntity` = `$inferSelect`). An
     * id read from such a parameter follows a stored reference, not client input.
     */
    rowTypeSuffix: 'Entity',
    /** Relational `where` operators that can carry a tenant condition. */
    whereOperators: ['AND', 'OR', 'RAW'],
    /** Drizzle comparisons that constrain a column by a value: `eq(t.id, v)`. */
    idComparisons: ['eq', 'inArray'],
    /** Conjunctions: `and(eq(t.id, v), ...)` is id-only unless an arm hits a tenant column. */
    conjunctions: ['and'],
    /** Builder calls that write: a check must run before them, not after. */
    writeMethods: ['update', 'delete'],
    /** Parameter decorators carrying client input: never a trusted header unit. */
    clientInputDecorators: ['Args', 'Body', 'Param', 'Query'],
    /**
     * Calls that prove the loaded resource belongs to the caller's tenant.
     * Must be passed the variable holding the query result (or its fields).
     */
    scopeHelpers: [
      'assertResourceInScope',
      'assertUserInScope',
      'assertOrganizationInScope',
    ],
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
