import { describe, expect, it } from 'bun:test';
import { canManageRoles } from './role-access';

describe('canManageRoles', () => {
  it('requires both the top unit and role:manage', () => {
    expect(canManageRoles({ isRoot: true, hasRoleManage: true })).toBe(true);
    expect(canManageRoles({ isRoot: true, hasRoleManage: false })).toBe(false);
    expect(canManageRoles({ isRoot: false, hasRoleManage: true })).toBe(false);
    expect(canManageRoles({ isRoot: false, hasRoleManage: false })).toBe(false);
  });

  it('fails closed when a value is missing', () => {
    expect(canManageRoles({})).toBe(false);
    expect(canManageRoles({ isRoot: true })).toBe(false);
    expect(canManageRoles({ hasRoleManage: true })).toBe(false);
  });
});
