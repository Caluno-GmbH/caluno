import { describe, expect, it } from 'bun:test';
import { Project } from 'ts-morph';
import {
  collectTenantTables,
  findUnscopedTenantQueries,
  type TenantQueryOptions,
} from './tenant-queries.js';

const opts: TenantQueryOptions = {
  tenantFields: ['organizationUnitId', 'organizationId'],
  scopeHelpers: ['assertResourceInScope', 'assertOrganizationInScope'],
  exemptionMarker: 'tenant-scope-ok:',
};

const SCHEMA = `
  export const roles = snakeCase.table('roles', {
    id: uuid('id'),
    organizationId: uuid('organization_id'),
  });
  export const events = snakeCase.table('events', {
    id: uuid('id'),
    organizationUnitId: uuid('organization_unit_id'),
  });
  export const permissions = snakeCase.table('permissions', {
    id: uuid('id'),
    key: text('key'),
  });
`;

function scan(source: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const schema = project.createSourceFile('role.schema.ts', SCHEMA);
  const sf = project.createSourceFile('file.ts', source);
  const tables = collectTenantTables([schema], opts.tenantFields);
  return findUnscopedTenantQueries(
    sf,
    tables,
    opts,
    'organizationUnitId',
    (p) => p,
  );
}

describe('collectTenantTables', () => {
  it('keeps only tables with a tenant column', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const schema = project.createSourceFile('role.schema.ts', SCHEMA);
    expect(
      [...collectTenantTables([schema], opts.tenantFields)].sort(),
    ).toEqual(['events', 'roles']);
  });
});

describe('findUnscopedTenantQueries', () => {
  it('flags findFirst by id alone on a tenant table', () => {
    const findings = scan(`
      class S { async f(id: string) {
        return this.db.query.roles.findFirst({ where: { id } });
      } }`);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      table: 'roles',
      shape: 'relational-where-id',
    });
  });

  it('flags findMany with an explicit id key', () => {
    expect(
      scan(`const r = db.query.events.findMany({ where: { id: eventId } });`),
    ).toHaveLength(1);
  });

  it('flags an update/delete constrained by eq(table.id)', () => {
    const findings = scan(`
      const a = db.update(schema.events).set({}).where(eq(schema.events.id, id));
      const b = db.delete(roles).where(eq(roles.id, id));`);
    expect(findings.map((f) => f.shape)).toEqual([
      'builder-where-eq-id',
      'builder-where-eq-id',
    ]);
  });

  it('ignores a query that also constrains the tenant', () => {
    expect(
      scan(`
        db.query.roles.findFirst({ where: { id, organizationId } });
        db.query.events.findFirst({ where: { id, organizationUnitId: unit } });
        db.update(events).where(and(eq(events.id, id), eq(events.organizationUnitId, u)));`),
    ).toEqual([]);
  });

  it('ignores a where that uses AND, OR or a spread', () => {
    expect(
      scan(`
        db.query.roles.findFirst({ where: { id, AND: [{ organizationId }] } });
        db.query.roles.findFirst({ where: { id, ...scope } });`),
    ).toEqual([]);
  });

  it('ignores tables without a tenant column', () => {
    expect(scan(`db.query.permissions.findFirst({ where: { id } });`)).toEqual(
      [],
    );
  });

  it('ignores a function that calls a scope helper', () => {
    expect(
      scan(`
        class S { async f(unitId: string, id: string) {
          const role = await this.db.query.roles.findFirst({ where: { id } });
          await this.tenantScope.assertOrganizationInScope(unitId, role?.organizationId);
          return role;
        } }`),
    ).toEqual([]);
  });

  it('still flags a sibling function that has no helper call', () => {
    expect(
      scan(`
        class S {
          async safe(unitId: string, id: string) {
            const e = await this.db.query.events.findFirst({ where: { id } });
            await this.tenantScope.assertResourceInScope(unitId, e?.organizationUnitId);
          }
          async unsafe(id: string) {
            return this.db.query.events.findFirst({ where: { id } });
          }
        }`),
    ).toHaveLength(1);
  });

  it('honours an exemption comment', () => {
    expect(
      scan(`
        async function f(id: string) {
          // tenant-scope-ok: id comes from the caller's own session
          return db.query.roles.findFirst({ where: { id } });
        }`),
    ).toEqual([]);
  });

  it('marks findings inside a resolver that reads the client tenant', () => {
    const findings = scan(`
      @Resolver(() => Role)
      class R { async f(@Context() c: Ctx, id: string) {
        return this.db.query.roles.findFirst({ where: { id }, c: c.organizationUnitId });
      } }
      class S { async g(id: string) {
        return this.db.query.roles.findFirst({ where: { id } });
      } }`);
    expect(findings.map((f) => f.inTenantResolver)).toEqual([true, false]);
  });
});
