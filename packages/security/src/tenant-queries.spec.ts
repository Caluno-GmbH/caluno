import { describe, expect, it } from 'bun:test';
import { Project } from 'ts-morph';
import { config } from './config.js';
import {
  analyzeTenantQueries,
  collectTenantTables,
  type TenantQueryOptions,
} from './tenant-queries.js';

const opts: TenantQueryOptions = { ...config.tenantQueries, relpath: (p) => p };

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

function scan(...sources: string[]) {
  const project = new Project({ useInMemoryFileSystem: true });
  const schema = project.createSourceFile('role.schema.ts', SCHEMA);
  const files = sources.map((s, i) => project.createSourceFile(`f${i}.ts`, s));
  return analyzeTenantQueries(files, collectTenantTables([schema], opts), opts);
}

describe('collectTenantTables', () => {
  it('keeps tables with a tenant column plus the tenant root', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const schema = project.createSourceFile('role.schema.ts', SCHEMA);
    expect([...collectTenantTables([schema], opts)].sort()).toEqual([
      'events',
      'organizations',
      'roles',
    ]);
  });
});

describe('analyzeTenantQueries: shapes', () => {
  it('flags findFirst by id alone on a tenant table', () => {
    const findings = scan(`
      class S { async f(id: string) {
        return this.db.query.roles.findFirst({ where: { id } });
      } }`);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      table: 'roles',
      shape: 'relational-where-id',
      method: 'S.f',
    });
  });

  it('flags findMany with an explicit id key', () => {
    expect(
      scan(`function f(eventId: string) {
        return db.query.events.findMany({ where: { id: eventId } });
      }`),
    ).toHaveLength(1);
  });

  it('flags a relational where written as eq() or as a callback', () => {
    const findings = scan(`
      function f(id: string) {
        db.query.roles.findFirst({ where: eq(roles.id, id) });
        db.query.events.findFirst({ where: (t, { eq }) => eq(t.id, id) });
      }`);
    expect(findings.map((f) => f.shape)).toEqual([
      'relational-where-eq-id',
      'relational-where-eq-id',
    ]);
  });

  it('flags an update/delete constrained by eq(table.id)', () => {
    const findings = scan(`
      function f(id: string) {
        db.update(schema.events).set({}).where(eq(schema.events.id, id));
        db.delete(roles).where(eq(roles.id, id));
      }`);
    expect(findings.map((f) => f.shape)).toEqual([
      'builder-where-eq-id',
      'builder-where-eq-id',
    ]);
  });

  it('ignores a query that also constrains the tenant', () => {
    expect(
      scan(`function f(id: string, organizationId: string, unit: string) {
        db.query.roles.findFirst({ where: { id, organizationId } });
        db.query.events.findFirst({ where: { id, organizationUnitId: unit } });
        db.query.events.findFirst({ where: { id, organizationUnit: { id: unit } } });
        db.update(events).where(and(eq(events.id, id), eq(events.organizationUnitId, unit)));
      }`),
    ).toEqual([]);
  });

  it('ignores a where that uses AND, OR or a spread', () => {
    expect(
      scan(`function f(id: string) {
        db.query.roles.findFirst({ where: { id, AND: [{ organizationId }] } });
        db.query.roles.findFirst({ where: { id, ...scope } });
      }`),
    ).toEqual([]);
  });

  it('flags an update of the tenant root by id', () => {
    expect(
      scan(`function f(organizationId: string) {
        db.update(schema.organizations).set({}).where(eq(schema.organizations.id, organizationId));
      }`),
    ).toHaveLength(1);
  });

  it('ignores tables without a tenant column', () => {
    expect(
      scan(`function f(id: string) {
        db.query.permissions.findFirst({ where: { id } });
      }`),
    ).toEqual([]);
  });
});

describe('analyzeTenantQueries: loaded references', () => {
  it('ignores an id read from a row already loaded', () => {
    expect(
      scan(`async function f(eventId: string) {
        const row = await db.query.shifts.findFirst({ where: { eventId } });
        return db.query.events.findFirst({ where: { id: row!.eventId } });
      }`),
    ).toEqual([]);
  });

  it('ignores an id read from a parameter typed as a loaded row', () => {
    expect(
      scan(`function f(shift: ShiftEntity & { master: ShiftEntity }) {
        return db.query.events.findFirst({ where: { id: shift.master.eventId } });
      }`),
    ).toEqual([]);
  });

  it('still flags an id read from a parameter object', () => {
    expect(
      scan(`function f(input: { roleId: string }) {
        return db.query.roles.findFirst({ where: { id: input.roleId } });
      }`),
    ).toHaveLength(1);
  });
});

describe('analyzeTenantQueries: closing a finding', () => {
  it('closes when the helper checks the loaded result in the same function', () => {
    expect(
      scan(`
        class S { async f(unitId: string, id: string) {
          const role = await this.db.query.roles.findFirst({ where: { id } });
          await this.tenantScope.assertOrganizationInScope(unitId, role?.organizationId);
          return role;
        } }`),
    ).toEqual([]);
  });

  it('does not close when the helper checks a different resource', () => {
    const findings = scan(`
      class S { async f(unitId: string, id: string, otherId: string) {
        const event = await this.db.query.events.findFirst({ where: { id } });
        const role = await this.db.query.roles.findFirst({ where: { id: otherId } });
        await this.tenantScope.assertResourceInScope(unitId, event?.organizationUnitId);
        return role;
      } }`);
    expect(findings.map((f) => f.table)).toEqual(['roles']);
  });

  it('closes when every caller checks the returned resource', () => {
    expect(
      scan(
        `class RoleService { async findRole(id: string) {
          return this.db.query.roles.findFirst({ where: { id } });
        } }`,
        `class RoleResolver { async role(ctx: Ctx, id: string) {
          const role = await this.roleService.findRole(id);
          await this.tenantScope.assertOrganizationInScope(ctx.organizationUnitId, role.organizationId);
          return role;
        } }`,
      ),
    ).toEqual([]);
  });

  it('stays open when one caller does not check', () => {
    expect(
      scan(
        `class RoleService { async findRole(id: string) {
          return this.db.query.roles.findFirst({ where: { id } });
        } }`,
        `class A { async checked(ctx: Ctx, id: string) {
          const role = await this.roleService.findRole(id);
          await this.tenantScope.assertOrganizationInScope(ctx.organizationUnitId, role.organizationId);
        } }`,
        `class B { async unchecked(id: string) {
          return this.roleService.findRole(id);
        } }`,
      ),
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
});

describe('analyzeTenantQueries: reachedFrom', () => {
  it('lists the handlers that call the enclosing method', () => {
    const findings = scan(
      `class RoleService { async findRole(id: string) {
        return this.db.query.roles.findFirst({ where: { id } });
      } }`,
      `@Resolver(() => Role)
      class RoleResolver {
        @Query(() => Role)
        async role(@Context() context: Ctx, id: string) {
          return this.roleService.findRole(id, context.organizationUnitId);
        }
        @Query(() => Role)
        async publicRole(id: string) {
          return this.roleService.findRole(id);
        }
      }`,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      reachedFrom: ['RoleResolver.publicRole', 'RoleResolver.role'],
      readsTenantContext: true,
    });
  });

  it('marks a query whose handlers never read the client tenant', () => {
    const findings = scan(
      `class RoleService { async deleteRole(id: string) {
        return this.db.delete(roles).where(eq(roles.id, id));
      } }`,
      `@Resolver(() => Role)
      class RoleResolver {
        @Mutation(() => Role)
        async deleteRole(@Context() context: Ctx, id: string) {
          return this.roleService.deleteRole(id);
        }
      }`,
    );
    expect(findings[0]).toMatchObject({
      reachedFrom: ['RoleResolver.deleteRole'],
      readsTenantContext: false,
    });
  });
});
