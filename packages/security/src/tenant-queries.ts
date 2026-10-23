/**
 * INVARIANT B (tenant-scoped queries), as an AST rule.
 *
 * A read or write of a tenant table (one with an `organizationUnitId` /
 * `organizationId` column) that is constrained by `id` alone trusts that the id
 * belongs to the caller's tenant. PermissionGuard only checked the header unit,
 * so a foreign id passes unless the handler compares the resource's unit.
 *
 * Flagged shapes:
 *   db.query.<tenantTable>.findFirst|findMany({ where: { id } })
 *   .where(eq(<tenantTable>.id, value))        (select / update / delete)
 *
 * A finding is silenced when the enclosing function calls a scope helper
 * (assertResourceInScope / assertOrganizationInScope), or the statement is
 * preceded by `// tenant-scope-ok: <reason>`.
 *
 * Limit: only tables carrying a tenant column themselves are known. A table
 * scoped through a parent (shift -> event -> unit) is not detected.
 */
import {
  type CallExpression,
  Node,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';

export type TenantQueryOptions = {
  tenantFields: string[];
  scopeHelpers: string[];
  exemptionMarker: string;
};

export type TenantQueryFinding = {
  file: string;
  line: number;
  table: string;
  shape: 'relational-where-id' | 'builder-where-eq-id';
  /** The enclosing class is a resolver that reads the client-chosen tenant. */
  inTenantResolver: boolean;
  snippet: string;
};

const QUERY_METHODS = ['findFirst', 'findMany'];

/** Tables with a tenant column, keyed by their exported const name. */
export function collectTenantTables(
  schemaFiles: SourceFile[],
  tenantFields: string[],
): Set<string> {
  const tables = new Set<string>();
  for (const sf of schemaFiles) {
    for (const decl of sf.getVariableDeclarations()) {
      const call = decl.getInitializer()?.asKind(SyntaxKind.CallExpression);
      if (!call) continue;
      if (!/(^|\.)(table|pgTable)$/.test(call.getExpression().getText())) {
        continue;
      }

      const columns = call
        .getArguments()[1]
        ?.asKind(SyntaxKind.ObjectLiteralExpression);
      if (!columns) continue;

      const hasTenantColumn = columns
        .getProperties()
        .some(
          (p) =>
            Node.isPropertyAssignment(p) && tenantFields.includes(p.getName()),
        );
      if (hasTenantColumn) tables.add(decl.getName());
    }
  }
  return tables;
}

function enclosingFunction(node: Node): Node | undefined {
  return node.getFirstAncestor(
    (a) =>
      Node.isMethodDeclaration(a) ||
      Node.isFunctionDeclaration(a) ||
      Node.isArrowFunction(a) ||
      Node.isFunctionExpression(a),
  );
}

function callsScopeHelper(fn: Node | undefined, helpers: string[]): boolean {
  if (!fn) return false;
  return fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
    const callee = c.getExpression();
    const name = Node.isPropertyAccessExpression(callee)
      ? callee.getName()
      : callee.getText();
    return helpers.includes(name);
  });
}

function hasExemption(node: Node, marker: string): boolean {
  const statement = node.getFirstAncestor((a) => Node.isStatement(a)) ?? node;
  return statement
    .getLeadingCommentRanges()
    .some((r) => r.getText().includes(marker));
}

function isTenantResolver(node: Node, contextProperty: string): boolean {
  const cls = node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
  if (!cls) return false;
  const isResolver = cls
    .getDecorators()
    .some((d) => d.getName() === 'Resolver');
  return isResolver && cls.getText().includes(contextProperty);
}

/** `where: { id }` / `{ id: x }` with no tenant key, no AND/OR/RAW/spread. */
function relationalWhereIsIdOnly(
  call: CallExpression,
  tenantFields: string[],
): boolean {
  const arg = call
    .getArguments()[0]
    ?.asKind(SyntaxKind.ObjectLiteralExpression);
  const where = arg
    ?.getProperty('where')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializer()
    ?.asKind(SyntaxKind.ObjectLiteralExpression);
  if (!where) return false;

  const keys = where
    .getProperties()
    .map((p) =>
      Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)
        ? p.getName()
        : '<spread>',
    );
  const scopingKeys = [
    ...tenantFields,
    'organizationUnit',
    'organization',
    'AND',
    'OR',
    'RAW',
    '<spread>',
  ];
  return keys.includes('id') && !keys.some((k) => scopingKeys.includes(k));
}

export function findUnscopedTenantQueries(
  sf: SourceFile,
  tenantTables: Set<string>,
  opts: TenantQueryOptions,
  contextProperty: string,
  relpath: (abs: string) => string,
): TenantQueryFinding[] {
  const findings: TenantQueryFinding[] = [];

  const report = (
    node: Node,
    table: string,
    shape: TenantQueryFinding['shape'],
  ) => {
    if (hasExemption(node, opts.exemptionMarker)) return;
    if (callsScopeHelper(enclosingFunction(node), opts.scopeHelpers)) return;
    findings.push({
      file: relpath(sf.getFilePath()),
      line: node.getStartLineNumber(),
      table,
      shape,
      inTenantResolver: isTenantResolver(node, contextProperty),
      snippet: node.getText().replace(/\s+/g, ' ').slice(0, 160),
    });
  };

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) continue;

    // <db>.query.<table>.findFirst({ where: { id } })
    if (QUERY_METHODS.includes(callee.getName())) {
      const tableAccess = callee.getExpression();
      if (
        Node.isPropertyAccessExpression(tableAccess) &&
        tenantTables.has(tableAccess.getName()) &&
        tableAccess.getExpression().getText().endsWith('.query') &&
        relationalWhereIsIdOnly(call, opts.tenantFields)
      ) {
        report(call, tableAccess.getName(), 'relational-where-id');
      }
      continue;
    }

    // .where(eq(<tenantTable>.id, value))
    if (callee.getName() === 'where') {
      const cond = call.getArguments()[0]?.asKind(SyntaxKind.CallExpression);
      if (!cond) continue;
      if (cond.getExpression().getText() !== 'eq') continue;
      const column = cond.getArguments()[0];
      if (!column || !Node.isPropertyAccessExpression(column)) continue;
      if (column.getName() !== 'id') continue;
      const owner = column.getExpression();
      const table = Node.isPropertyAccessExpression(owner)
        ? owner.getName()
        : owner.getText();
      if (tenantTables.has(table)) report(call, table, 'builder-where-eq-id');
    }
  }
  return findings;
}
