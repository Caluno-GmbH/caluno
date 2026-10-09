import { describe, expect, it } from 'bun:test';
import { AgreementStatus } from '@repo/data';
import { resolveAgreementTrigger } from './check-in-agreement';

describe('resolveAgreementTrigger', () => {
  it('returns null for null input', () => {
    expect(resolveAgreementTrigger(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(resolveAgreementTrigger(undefined)).toBeNull();
  });

  it('returns null for ACTIVE status', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.Active,
        canManageAgreements: true,
      }),
    ).toBeNull();
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.Active,
        canManageAgreements: false,
      }),
    ).toBeNull();
  });

  it('returns null for NOT_APPLICABLE status', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.NotApplicable,
        canManageAgreements: true,
      }),
    ).toBeNull();
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.NotApplicable,
        canManageAgreements: false,
      }),
    ).toBeNull();
  });

  it('returns error/noTemplate with hasAction=true when canManageAgreements=true', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.NoTemplate,
        canManageAgreements: true,
      }),
    ).toEqual({ severity: 'error', kind: 'noTemplate', hasAction: true });
  });

  it('returns error/noTemplate with hasAction=false when canManageAgreements=false', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.NoTemplate,
        canManageAgreements: false,
      }),
    ).toEqual({ severity: 'error', kind: 'noTemplate', hasAction: false });
  });

  it('returns warning/noContract with hasAction=true when canManageAgreements=true', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.NoContract,
        canManageAgreements: true,
      }),
    ).toEqual({ severity: 'warning', kind: 'noContract', hasAction: true });
  });

  it('returns warning/noContract with hasAction=false when canManageAgreements=false', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.NoContract,
        canManageAgreements: false,
      }),
    ).toEqual({ severity: 'warning', kind: 'noContract', hasAction: false });
  });

  it('returns warning/awaitingCountersign with hasAction=true when canManageAgreements=true', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.AwaitingCountersignature,
        canManageAgreements: true,
      }),
    ).toEqual({
      severity: 'warning',
      kind: 'awaitingCountersign',
      hasAction: true,
    });
  });

  it('returns warning/awaitingCountersign with hasAction=false when canManageAgreements=false', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.AwaitingCountersignature,
        canManageAgreements: false,
      }),
    ).toEqual({
      severity: 'warning',
      kind: 'awaitingCountersign',
      hasAction: false,
    });
  });

  it('returns warning/awaitingVolunteerSign with hasAction=false regardless of canManageAgreements', () => {
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.AwaitingVolunteerSignature,
        canManageAgreements: true,
      }),
    ).toEqual({
      severity: 'warning',
      kind: 'awaitingVolunteerSign',
      hasAction: false,
    });
    expect(
      resolveAgreementTrigger({
        status: AgreementStatus.AwaitingVolunteerSignature,
        canManageAgreements: false,
      }),
    ).toEqual({
      severity: 'warning',
      kind: 'awaitingVolunteerSign',
      hasAction: false,
    });
  });
});
