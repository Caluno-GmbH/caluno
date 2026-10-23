/**
 * INVARIANT B (tenant-scoped queries), as an AST rule.
 *
 * A read or write of a tenant table (one with an `organizationUnitId` /
 * `organizationId` column, or the tenant root) that is constrained by `id`
 * alone trusts that the id belongs to the caller's tenant. PermissionGuard only
 * checked the header unit, so a foreign id passes unless the resource's unit is
 * compared with it.
 *
 * Flagged shapes:
 *   db.query.<table>.findFirst|findMany({ where: { id } })
 *   db.query.<table>.findFirst({ where: eq(t.id, v) })        (also inArray,
 *     and(...) without a tenant arm, and the callback form `(t, ops) => ...`)
 *   .where(eq(<table>.id, v))          (same conditions; select/update/delete)
 *
 * Not flagged: an id read from a loaded row, i.e. a field of a variable
 * assigned from a call (`const row = await ...`), of a loop over such a value,
 * or of a parameter typed as a row (`shift: ShiftEntity`). That follows a
 * stored reference, not client input. Aliases of a parameter (`const a = input`)
 * are not loaded rows.
 *
 * A finding is closed by a scope helper whose first argument is the header unit
 * (`ctx.organizationUnitId` on a `@Context()` or `*Context`-typed parameter, or
 * a parameter handed down that is not decorated as client input) and that is
 * either
 *   - for a read: passed the variable holding the result, or
 *   - for a write: called before the write,
 * in the same function or in EVERY caller of the enclosing method (the service
 * loads, the resolver checks). Or exempt the statement with
 * `// tenant-scope-ok: <reason>` (the reason is required).
 *
 * Callers are matched by method name, one level up, so a common name shared by
 * unrelated classes makes closing harder, never easier: every caller must check.
 * Whether a helper call actually runs (branches, early returns) is not analysed.
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
  idComparisons: string[];
  conjunctions: string[];
  writeMethods: string[];
  clientInputDecorators: string[];
  scopeHelpers: string[];
  exemptionMarker: string;
  /** GraphQL context property carrying the header unit. */
  contextProperty: string;
  contextParamDecorators: string[];
  /** Class decorators of resolvers and controllers. */
  entryClassDecorators: string[];
  /** Path as reported, e.g. relative to the repo root. */
  relpath: (abs: string) => string;
};

/** The rule options as calibrated in config.ts. */
export function tenantQueryOptions(
  relpath: (abs: string) => string,
): TenantQueryOptions {
  const { schemaGlobs: _schemaGlobs, ...rule } = config.tenantQueries;
  return {
    ...rule,
    contextProperty: config.tenantContext.contextProperty,
    contextParamDecorators: config.tenantContext.contextParamDecorators,
    entryClassDecorators: [
      ...config.transport.resolverClass,
      ...config.transport.controllerClass,
    ],
    relpath,
  };
}

export type TenantQueryShape =
  | 'relational-where-id'
  | 'relational-where-condition'
  | 'builder-where-condition';

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
  /** An update/delete: only a check before it protects the row. */
  isWrite: boolean;
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

function enclosingFunction(node: Node): Node | undefined {
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

const calleeName = (call: CallExpression): string => {
  const callee = call.getExpression();
  return Node.isPropertyAccessExpression(callee)
    ? callee.getName()
    : callee.getText();
};

/** Strip `await`, `!`, `as`, parentheses. */
function unwrap(node: Node | undefined): Node | undefined {
  let expr = node;
  while (
    expr &&
    (Node.isAwaitExpression(expr) ||
      Node.isNonNullExpression(expr) ||
      Node.isAsExpression(expr) ||
      Node.isParenthesizedExpression(expr))
  ) {
    expr = expr.getExpression();
  }
  return expr;
}

/**
 * `eq(<owner>.id, v)`, `inArray(<owner>.id, vs)`, or `and(...)` holding one of
 * those and no arm on a tenant column -> the owner's name and compared value.
 */
function idCondition(
  node: Node | undefined,
  opts: TenantQueryOptions,
): { owner: string; idValue: Node | undefined } | undefined {
  const call = node?.asKind(SyntaxKind.CallExpression);
  if (!call) return undefined;
  const fn = call.getExpression().getText();

  if (opts.conjunctions.includes(fn)) {
    const touchesTenant = call
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((p) => opts.tenantFields.includes(p.getName()));
    if (touchesTenant) return undefined;
    for (const arm of call.getArguments()) {
      const match = idCondition(arm, opts);
      if (match) return match;
    }
    return undefined;
  }

  if (!opts.idComparisons.includes(fn)) return undefined;
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
  const match = idCondition(body, opts);
  return (
    match && { shape: 'relational-where-condition', idValue: match.idValue }
  );
}

/** `db.update(t)...where(...)`: the chain below `.where` holds a write call. */
function isWriteChain(
  where: CallExpression,
  opts: TenantQueryOptions,
): boolean {
  let node: Node | undefined = where.getExpression();
  while (node) {
    if (
      Node.isCallExpression(node) &&
      opts.writeMethods.includes(calleeName(node))
    ) {
      return true;
    }
    node =
      Node.isCallExpression(node) || Node.isPropertyAccessExpression(node)
        ? node.getExpression()
        : undefined;
  }
  return false;
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
      if (match) {
        candidates.push({
          call,
          table: tableAccess.getName(),
          ...match,
          isWrite: false,
        });
      }
      continue;
    }

    // .where(eq(<table>.id, v)) and friends
    if (callee.getName() === 'where') {
      const match = idCondition(call.getArguments()[0], opts);
      if (match && tenantTables.has(match.owner)) {
        candidates.push({
          call,
          table: match.owner,
          shape: 'builder-where-condition',
          idValue: match.idValue,
          isWrite: isWriteChain(call, opts),
        });
      }
    }
  }
  return candidates;
}

/**
 * The value comes from storage: a call result, a loop over one, a field of one,
 * or a parameter typed as a row. Parameters and their aliases are client input.
 */
function isLoadedValue(
  node: Node | undefined,
  opts: TenantQueryOptions,
  depth = 0,
): boolean {
  const expr = unwrap(node);
  if (!expr || depth > 4) return false;
  if (Node.isCallExpression(expr)) return true;
  if (Node.isPropertyAccessExpression(expr)) {
    return isLoadedValue(expr.getExpression(), opts, depth + 1);
  }
  if (!Node.isIdentifier(expr)) return false;

  const rowType = new RegExp(`\\w${opts.rowTypeSuffix}\\b`);
  const declarations = expr.getSymbol()?.getDeclarations() ?? [];
  return (
    declarations.length > 0 &&
    declarations.every((d) => {
      if (Node.isParameterDeclaration(d)) {
        return rowType.test(d.getTypeNode()?.getText() ?? '');
      }
      const variable = Node.isBindingElement(d)
        ? d.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
        : Node.isVariableDeclaration(d)
          ? d
          : undefined;
      if (!variable) return false;
      const loop = variable
        .getParent()
        ?.getParent()
        ?.asKind(SyntaxKind.ForOfStatement);
      return loop
        ? isLoadedValue(loop.getExpression(), opts, depth + 1)
        : isLoadedValue(variable.getInitializer(), opts, depth + 1);
    })
  );
}

/** `row.organizationUnitId` where `row` is a loaded value. */
function isLoadedReference(
  idValue: Node | undefined,
  opts: TenantQueryOptions,
): boolean {
  const expr = unwrap(idValue);
  return (
    !!expr &&
    Node.isPropertyAccessExpression(expr) &&
    isLoadedValue(expr.getExpression(), opts)
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

/**
 * The header unit: `<@Context param>.organizationUnitId`, or a parameter handed
 * down from the caller that is not decorated as client input.
 */
function isHeaderUnit(
  node: Node | undefined,
  opts: TenantQueryOptions,
): boolean {
  const expr = unwrap(node);
  if (!expr) return false;

  const paramOf = (id: Node) =>
    id
      .getSymbol()
      ?.getDeclarations()
      .find((d) => Node.isParameterDeclaration(d));
  const decorators = (id: Node) =>
    paramOf(id)?.asKind(SyntaxKind.Parameter)?.getDecorators().map(decoName) ??
    [];

  if (Node.isPropertyAccessExpression(expr)) {
    const owner = expr.getExpression();
    if (expr.getName() !== opts.contextProperty || !Node.isIdentifier(owner)) {
      return false;
    }
    // `@Context() ctx`, or a context handed down (`ctx: AuthenticatedGraphQLContext`)
    const typeText =
      paramOf(owner)?.asKind(SyntaxKind.Parameter)?.getTypeNode()?.getText() ??
      '';
    return (
      decorators(owner).some((d) => opts.contextParamDecorators.includes(d)) ||
      /Context\b/.test(typeText)
    );
  }
  if (Node.isIdentifier(expr) && paramOf(expr)) {
    return !decorators(expr).some((d) =>
      opts.clientInputDecorators.includes(d),
    );
  }
  return false;
}

/**
 * A scope helper on the header unit inside `fn` that protects the resource:
 * passed one of `variables` (read), or called before `before` (write).
 */
function scopeCheckedIn(
  fn: Node | undefined,
  target: { variables: string[] } | { before: Node },
  opts: TenantQueryOptions,
): boolean {
  if (!fn) return false;
  return fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
    if (!opts.scopeHelpers.includes(calleeName(c))) return false;
    const [header, ...resource] = c.getArguments();
    if (!isHeaderUnit(header, opts)) return false;
    if ('before' in target) return c.getStart() < target.before.getStart();
    return resource.some((arg) =>
      [arg, ...arg.getDescendantsOfKind(SyntaxKind.Identifier)].some(
        (id) =>
          Node.isIdentifier(id) && target.variables.includes(id.getText()),
      ),
    );
  });
}

/** `// tenant-scope-ok: <reason>` with a non-empty reason. */
function hasExemption(node: Node, marker: string): boolean {
  const statement = node.getFirstAncestor((a) => Node.isStatement(a)) ?? node;
  return statement.getLeadingCommentRanges().some((r) => {
    const text = r.getText();
    const at = text.indexOf(marker);
    return at >= 0 && text.slice(at + marker.length).trim().length > 0;
  });
}

export function analyzeTenantQueries(
  files: SourceFile[],
  tenantTables: Set<string>,
  opts: TenantQueryOptions,
): TenantQueryFinding[] {
  // Calls by method name, for the one-level caller analysis.
  const callsByName = new Map<string, CallExpression[]>();
  for (const sf of files) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!Node.isPropertyAccessExpression(call.getExpression())) continue;
      const name = calleeName(call);
      const list = callsByName.get(name) ?? [];
      list.push(call);
      callsByName.set(name, list);
    }
  }

  const isHandler = (
    m: MethodDeclaration | undefined,
  ): m is MethodDeclaration =>
    m
      ?.getParent()
      .asKind(SyntaxKind.ClassDeclaration)
      ?.getDecorators()
      .some((d) => opts.entryClassDecorators.includes(decoName(d))) ?? false;

  const callersOf = (m: MethodDeclaration): CallExpression[] =>
    (callsByName.get(m.getName()) ?? []).filter(
      (c) => enclosingMethod(c) !== m,
    );

  // Protected at `call` (the query, or a call of its enclosing method).
  const checkedAt = (call: CallExpression, isWrite: boolean): boolean =>
    scopeCheckedIn(
      enclosingFunction(call),
      isWrite ? { before: call } : { variables: resultVariables(call) },
      opts,
    );

  const findings: TenantQueryFinding[] = [];
  for (const sf of files) {
    for (const c of findCandidates(sf, tenantTables, opts)) {
      if (hasExemption(c.call, opts.exemptionMarker)) continue;
      if (isLoadedReference(c.idValue, opts)) continue;
      if (checkedAt(c.call, c.isWrite)) continue;

      const method = enclosingMethod(c.call);
      const callers = method ? callersOf(method) : [];
      if (
        callers.length > 0 &&
        callers.every((caller) => checkedAt(caller, c.isWrite))
      ) {
        continue;
      }

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
