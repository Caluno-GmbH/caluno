/**
 * INVARIANT B (tenant-scoped queries), as an AST rule.
 *
 * A read or write of a tenant table (one with an `organizationUnitId` /
 * `organizationId` column) that is constrained by `id` alone trusts that the id
 * belongs to the caller's tenant. PermissionGuard only checked the header unit,
 * so a foreign id passes unless the resource's unit is compared with it.
 *
 * Flagged shapes:
 *   db.query.<tenantTable>.findFirst|findMany({ where: { id } })
 *   db.query.<tenantTable>.findFirst({ where: eq(t.id, v) })      (and the
 *     callback form `where: (t, { eq }) => eq(t.id, v)`)
 *   .where(eq(<tenantTable>.id, v))                (select / update / delete)
 *
 * Not flagged: an id read from a field of a local variable (`row.unitId`). That
 * follows a reference from a row already loaded, not client input.
 *
 * A finding is closed when a scope helper is passed the variable holding the
 * result, either in the same function or in EVERY caller of the enclosing
 * method (the service loads, the resolver checks). Or exempt the statement with
 * `// tenant-scope-ok: <reason>`.
 *
 * Callers are matched by method name, one level up, so a common name shared by
 * unrelated classes makes closing harder, never easier: every caller must check.
 *
 * Limit: only tables carrying a tenant column themselves are known. A table
 * scoped through a parent (shift -> event -> unit) is not detected.
 */
import {
  type CallExpression,
  type MethodDeclaration,
  Node,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';
import { config } from './config.js';
import { decoName, tenantContextUse } from './tenant-context.js';

export type TenantQueryOptions = {
  tenantFields: string[];
  tenantRootTables: string[];
  tableFactories: string[];
  queryMethods: string[];
  tenantRelations: string[];
  rowTypeSuffix: string;
  whereOperators: string[];
  scopeHelpers: string[];
  exemptionMarker: string;
  /** Path as reported, e.g. relative to the repo root. */
  relpath: (abs: string) => string;
};

export type TenantQueryShape =
  | 'relational-where-id'
  | 'relational-where-eq-id'
  | 'builder-where-eq-id';

export type TenantQueryFinding = {
  file: string;
  line: number;
  table: string;
  shape: TenantQueryShape;
  /** Enclosing `Class.method`, or null outside a class method. */
  method: string | null;
  /** Resolver/controller handlers that run this query (one call level). */
  reachedFrom: string[];
  /** One of those handlers reads the client-chosen tenant. */
  readsTenantContext: boolean;
  snippet: string;
};

type Candidate = {
  call: CallExpression;
  table: string;
  shape: TenantQueryShape;
  /** Expression compared with `id`. */
  idValue: Node | undefined;
};

/**
 * Tables with a tenant column plus the tenant root tables, keyed by their
 * exported const name.
 */
export function collectTenantTables(
  schemaFiles: SourceFile[],
  opts: Pick<
    TenantQueryOptions,
    'tenantFields' | 'tenantRootTables' | 'tableFactories'
  >,
): Set<string> {
  const tables = new Set<string>(opts.tenantRootTables);
  for (const sf of schemaFiles) {
    for (const decl of sf.getVariableDeclarations()) {
      const call = decl.getInitializer()?.asKind(SyntaxKind.CallExpression);
      if (!call) continue;
      const factory = call.getExpression().getText().replace(/^.*\./, '');
      if (!opts.tableFactories.includes(factory)) continue;

      const columns = call
        .getArguments()[1]
        ?.asKind(SyntaxKind.ObjectLiteralExpression);
      const hasTenantColumn = columns
        ?.getProperties()
        .some(
          (p) =>
            Node.isPropertyAssignment(p) &&
            opts.tenantFields.includes(p.getName()),
        );
      if (hasTenantColumn) tables.add(decl.getName());
    }
  }
  return tables;
}

type FunctionLike = Node;

function enclosingFunction(node: Node): FunctionLike | undefined {
  return node.getFirstAncestor(
    (a) =>
      Node.isMethodDeclaration(a) ||
      Node.isFunctionDeclaration(a) ||
      Node.isArrowFunction(a) ||
      Node.isFunctionExpression(a),
  );
}

function enclosingMethod(node: Node): MethodDeclaration | undefined {
  return node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
}

const methodId = (m: MethodDeclaration): string =>
  `${m.getParent().asKind(SyntaxKind.ClassDeclaration)?.getName() ?? '<anon>'}.${m.getName()}`;

/** `eq(<owner>.id, value)` -> the owner's name and the compared value. */
function eqOnId(
  node: Node | undefined,
): { owner: string; idValue: Node | undefined } | undefined {
  const call = node?.asKind(SyntaxKind.CallExpression);
  if (!call) return undefined;
  if (call.getExpression().getText() !== 'eq') return undefined;
  const column = call.getArguments()[0];
  if (!Node.isPropertyAccessExpression(column) || column.getName() !== 'id') {
    return undefined;
  }
  const owner = column.getExpression();
  return {
    owner: Node.isPropertyAccessExpression(owner)
      ? owner.getName()
      : owner.getText(),
    idValue: call.getArguments()[1],
  };
}

/** The relational `where`, if it constrains by `id` and nothing tenant-like. */
function relationalIdOnly(
  call: CallExpression,
  opts: TenantQueryOptions,
): Pick<Candidate, 'shape' | 'idValue'> | undefined {
  const where = call
    .getArguments()[0]
    ?.asKind(SyntaxKind.ObjectLiteralExpression)
    ?.getProperty('where')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializer();
  if (!where) return undefined;

  if (Node.isObjectLiteralExpression(where)) {
    const blocking = [
      ...opts.tenantFields,
      ...opts.tenantRelations,
      ...opts.whereOperators,
    ];
    let idValue: Node | undefined;
    for (const p of where.getProperties()) {
      if (Node.isShorthandPropertyAssignment(p)) {
        if (blocking.includes(p.getName())) return undefined;
        if (p.getName() === 'id') idValue = p.getNameNode();
      } else if (Node.isPropertyAssignment(p)) {
        if (blocking.includes(p.getName())) return undefined;
        if (p.getName() === 'id') idValue = p.getInitializer();
      } else {
        return undefined; // spread: may carry the tenant condition
      }
    }
    return idValue ? { shape: 'relational-where-id', idValue } : undefined;
  }

  const body = Node.isArrowFunction(where) ? where.getBody() : where;
  const eq = eqOnId(body);
  return eq && { shape: 'relational-where-eq-id', idValue: eq.idValue };
}

function findCandidates(
  sf: SourceFile,
  tenantTables: Set<string>,
  opts: TenantQueryOptions,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) continue;

    // <db>.query.<table>.findFirst(...)
    if (opts.queryMethods.includes(callee.getName())) {
      const tableAccess = callee.getExpression();
      if (
        !Node.isPropertyAccessExpression(tableAccess) ||
        !tenantTables.has(tableAccess.getName()) ||
        !tableAccess.getExpression().getText().endsWith('.query')
      ) {
        continue;
      }
      const match = relationalIdOnly(call, opts);
      if (match)
        candidates.push({ call, table: tableAccess.getName(), ...match });
      continue;
    }

    // .where(eq(<table>.id, v))
    if (callee.getName() === 'where') {
      const eq = eqOnId(call.getArguments()[0]);
      if (eq && tenantTables.has(eq.owner)) {
        candidates.push({
          call,
          table: eq.owner,
          shape: 'builder-where-eq-id',
          idValue: eq.idValue,
        });
      }
    }
  }
  return candidates;
}

/**
 * `row.organizationUnitId` where `row` is a local, or a parameter typed as a
 * loaded row (`shift: ShiftEntity`). Not `input.unitId` from a parameter.
 */
function isLoadedReference(
  idValue: Node | undefined,
  rowTypeSuffix: string,
): boolean {
  let expr = idValue;
  while (expr && Node.isNonNullExpression(expr)) expr = expr.getExpression();
  if (!expr || !Node.isPropertyAccessExpression(expr)) return false;

  let root: Node = expr;
  while (
    Node.isPropertyAccessExpression(root) ||
    Node.isNonNullExpression(root)
  ) {
    root = root.getExpression();
  }
  if (!Node.isIdentifier(root)) return false;

  const rowType = new RegExp(`\\w${rowTypeSuffix}\\b`);
  const declarations = root.getSymbol()?.getDeclarations() ?? [];
  return (
    declarations.length > 0 &&
    declarations.every((d) => {
      if (Node.isParameterDeclaration(d)) {
        return rowType.test(d.getTypeNode()?.getText() ?? '');
      }
      return (
        (Node.isVariableDeclaration(d) || Node.isBindingElement(d)) &&
        !d.getFirstAncestorByKind(SyntaxKind.Parameter)
      );
    })
  );
}

/** Variables the (awaited, chained) call result is assigned to. */
function resultVariables(call: CallExpression): string[] {
  let node: Node = call;
  for (;;) {
    const parent = node.getParent();
    if (!parent) return [];
    const chained = Node.isPropertyAccessExpression(parent)
      ? parent.getParent()?.asKind(SyntaxKind.CallExpression)
      : undefined;
    if (chained && chained.getExpression() === parent) {
      node = chained; // .where(...).returning()
    } else if (
      Node.isAwaitExpression(parent) ||
      Node.isParenthesizedExpression(parent) ||
      Node.isNonNullExpression(parent) ||
      Node.isAsExpression(parent)
    ) {
      node = parent;
    } else if (Node.isVariableDeclaration(parent)) {
      const name = parent.getNameNode();
      return Node.isIdentifier(name)
        ? [name.getText()]
        : name
            .getDescendantsOfKind(SyntaxKind.BindingElement)
            .map((e) => e.getName());
    } else {
      return [];
    }
  }
}

/** A scope helper is passed one of `variables` inside `fn`. */
function scopeCheckedIn(
  fn: FunctionLike | undefined,
  variables: string[],
  helpers: string[],
): boolean {
  if (!fn || variables.length === 0) return false;
  return fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
    const callee = c.getExpression();
    const name = Node.isPropertyAccessExpression(callee)
      ? callee.getName()
      : callee.getText();
    if (!helpers.includes(name)) return false;
    return c
      .getArguments()
      .some((arg) =>
        [arg, ...arg.getDescendantsOfKind(SyntaxKind.Identifier)].some(
          (id) => Node.isIdentifier(id) && variables.includes(id.getText()),
        ),
      );
  });
}

function hasExemption(node: Node, marker: string): boolean {
  const statement = node.getFirstAncestor((a) => Node.isStatement(a)) ?? node;
  return statement
    .getLeadingCommentRanges()
    .some((r) => r.getText().includes(marker));
}

const isEntryClass = (m: MethodDeclaration): boolean => {
  const t = config.transport;
  const cls = m.getParent().asKind(SyntaxKind.ClassDeclaration);
  return (
    cls
      ?.getDecorators()
      .map(decoName)
      .some(
        (d) => t.resolverClass.includes(d) || t.controllerClass.includes(d),
      ) ?? false
  );
};

export function analyzeTenantQueries(
  files: SourceFile[],
  tenantTables: Set<string>,
  opts: TenantQueryOptions,
): TenantQueryFinding[] {
  // Calls by method name, for the one-level caller analysis.
  const callsByName = new Map<string, CallExpression[]>();
  for (const sf of files) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      if (!Node.isPropertyAccessExpression(callee)) continue;
      const list = callsByName.get(callee.getName()) ?? [];
      list.push(call);
      callsByName.set(callee.getName(), list);
    }
  }

  const isHandler = (
    m: MethodDeclaration | undefined,
  ): m is MethodDeclaration => m !== undefined && isEntryClass(m);

  const callersOf = (m: MethodDeclaration): CallExpression[] =>
    (callsByName.get(m.getName()) ?? []).filter(
      (c) => enclosingMethod(c) !== m,
    );

  const findings: TenantQueryFinding[] = [];
  for (const sf of files) {
    for (const c of findCandidates(sf, tenantTables, opts)) {
      if (hasExemption(c.call, opts.exemptionMarker)) continue;
      if (isLoadedReference(c.idValue, opts.rowTypeSuffix)) continue;

      const vars = resultVariables(c.call);
      if (scopeCheckedIn(enclosingFunction(c.call), vars, opts.scopeHelpers)) {
        continue;
      }

      const method = enclosingMethod(c.call);
      const callers = method ? callersOf(method) : [];
      const checkedByEveryCaller =
        callers.length > 0 &&
        callers.every((caller) =>
          scopeCheckedIn(
            enclosingFunction(caller),
            resultVariables(caller),
            opts.scopeHelpers,
          ),
        );
      if (checkedByEveryCaller) continue;

      const handlers = isHandler(method)
        ? [method]
        : [
            ...new Set(
              callers
                .map((caller) => enclosingMethod(caller))
                .filter(isHandler),
            ),
          ];

      findings.push({
        file: opts.relpath(sf.getFilePath()),
        line: c.call.getStartLineNumber(),
        table: c.table,
        shape: c.shape,
        method: method ? methodId(method) : null,
        reachedFrom: handlers.map(methodId).sort(),
        readsTenantContext: handlers.some((h) => tenantContextUse(h) !== null),
        snippet: c.call.getText().replace(/\s+/g, ' ').slice(0, 160),
      });
    }
  }
  return findings;
}
