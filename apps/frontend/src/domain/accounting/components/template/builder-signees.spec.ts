import { describe, expect, it } from 'bun:test';
import { PermissionKey, SigneeType } from '@repo/data';
import {
  defaultSignees,
  findAccountingManagePermissionId,
  toSigneeInputs,
} from './builder-signees';

describe('defaultSignees', () => {
  it('always returns volunteer then ACCOUNTING_MANAGE permission holder', () => {
    expect(defaultSignees('perm-accounting-manage')).toEqual([
      { order: 0, signeeType: SigneeType.Volunteer },
      {
        order: 1,
        signeeType: SigneeType.PermissionHolder,
        requiredPermissionId: 'perm-accounting-manage',
      },
    ]);
  });
});

describe('findAccountingManagePermissionId', () => {
  it('returns undefined while permissions have not loaded', () => {
    expect(findAccountingManagePermissionId(undefined)).toBeUndefined();
  });

  it('returns undefined when ACCOUNTING_MANAGE is absent', () => {
    expect(
      findAccountingManagePermissionId([
        { id: 'p-org', key: PermissionKey.OrgEdit },
      ]),
    ).toBeUndefined();
  });

  it('returns the ACCOUNTING_MANAGE permission id', () => {
    expect(
      findAccountingManagePermissionId([
        { id: 'p-org', key: PermissionKey.OrgEdit },
        { id: 'p-acc', key: PermissionKey.AccountingManage },
      ]),
    ).toBe('p-acc');
  });
});

describe('toSigneeInputs', () => {
  it('flattens the permission relation to its id', () => {
    expect(
      toSigneeInputs([
        {
          order: 0,
          signeeType: SigneeType.Volunteer,
          requiredPermission: null,
        },
        {
          order: 1,
          signeeType: SigneeType.PermissionHolder,
          requiredPermission: { id: 'perm-1' },
        },
      ]),
    ).toEqual([
      {
        order: 0,
        signeeType: SigneeType.Volunteer,
        requiredPermissionId: undefined,
      },
      {
        order: 1,
        signeeType: SigneeType.PermissionHolder,
        requiredPermissionId: 'perm-1',
      },
    ]);
  });
});
