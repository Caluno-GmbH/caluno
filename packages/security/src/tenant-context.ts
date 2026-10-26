/**
 * Shared AST predicates about the client-chosen tenant, used by the surface
 * inventory (invariant A) and the tenant-query rule (invariant B).
 */
import { type Decorator, type MethodDeclaration, SyntaxKind } from 'ts-morph';
import { config } from './config.js';

const tc = config.tenantContext;

/** Decorator name without call or namespace: `@Nest.Query()` -> `Query`. */
export const decoName = (d: Decorator): string => {
  const expr = d.getExpression();
  const call = expr.asKind(SyntaxKind.CallExpression);
  return (call ? call.getExpression().getText() : expr.getText()).replace(
    /^.*\./,
    '',
  );
};

/** Does the handler read the client-chosen tenant? Returns the evidence. */
export function tenantContextUse(m: MethodDeclaration): string | null {
  const body = m.getBody()?.getText() ?? '';
  const names: string[] = [];
  for (const p of m.getParameters()) {
    const decos = p.getDecorators();
    const ds = decos.map(decoName);
    const isCtx = ds.some((n) => tc.contextParamDecorators.includes(n));
    const isHdr = ds.some((n) => tc.headerParamDecorators.includes(n));
    if (isHdr && decos.some((d) => d.getText().includes(tc.header))) {
      return `@Headers('${tc.header}') ${p.getName()}`;
    }
    if (isCtx || isHdr) names.push(p.getName());
  }
  for (const n of names) {
    if (new RegExp(`\\b${n}\\.${tc.contextProperty}\\b`).test(body)) {
      return `${n}.${tc.contextProperty}`;
    }
    const destructure = new RegExp(
      `\\{[^}]*\\b${tc.contextProperty}\\b[^}]*\\}\\s*=\\s*${n}\\b`,
    );
    if (destructure.test(body)) return `destructured from ${n}`;
    if (body.includes(tc.header)) return `header ${tc.header} via ${n}`;
  }
  return null;
}
