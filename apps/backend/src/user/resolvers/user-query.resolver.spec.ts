import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { AuthService } from '../../auth/auth.service';
import { PERMISSIONS } from '../../auth/constants';
import type { UserEntity } from '../../auth/schemas/auth.schema';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { UserMapper } from '../mappers/user.mapper';
import type { UserService } from '../user.service';
import { UserQueryResolver } from './user-query.resolver';

const MASKED_IBAN = 'XXXX XXXX XXXX XXXX XXXX XX';
const MASKED_ACCOUNT_HOLDER = 'XXXXXX XXXXXX';
const MASKED_BIC = 'XXXXXXXXXXX';

const now = new Date('2026-09-15T08:00:00Z');

const volunteer = {
  id: 'volunteer-1',
  name: 'Volunteer One',
  email: 'volunteer@example.com',
  emailVerified: true,
  image: null,
  locale: 'de',
  emailWeeklyUpdateEnabled: true,
  emailUrgentCallsEnabled: true,
  emailPlatformEnabled: true,
  privacyPolicyVersion: null,
  privacyPolicyAcceptedAt: null,
  checkInId: 'CHKIN01',
  firstname: 'Erika',
  lastname: 'Musterfrau',
  preferredName: null,
  gender: null,
  phone: null,
  street: 'Musterstraße 1',
  zip: null,
  city: null,
  birthdate: null,
  iban: 'DE89 3704 0044 0532 0130 00',
  accountHolder: 'Erika Musterfrau',
  bic: 'COBADEFFXXX',
  createdAt: now,
  updatedAt: now,
} satisfies UserEntity;

const ctx = { organizationUnitId: 'unit-1' } as AuthenticatedGraphQLContext;

const sessionFor = (userId: string) =>
  ({ user: { id: userId } }) as unknown as UserSession;

describe('UserQueryResolver.user payment-data visibility', () => {
  let userService: {
    findByIdInOrgUnit: ReturnType<typeof mock>;
    findByIdOrThrow: ReturnType<typeof mock>;
  };
  let authService: { hasRequiredPermissions: ReturnType<typeof mock> };
  let resolver: UserQueryResolver;

  beforeEach(() => {
    userService = {
      findByIdInOrgUnit: mock(() => Promise.resolve(volunteer)),
      findByIdOrThrow: mock(() => Promise.resolve(volunteer)),
    };
    authService = {
      hasRequiredPermissions: mock(() => Promise.resolve(false)),
    };
    resolver = new UserQueryResolver(
      userService as unknown as UserService,
      new UserMapper(),
      authService as unknown as AuthService,
    );
  });

  it('masks iban and bic for a viewer without the accounting permission', async () => {
    authService.hasRequiredPermissions.mockResolvedValue(false);

    const result = await resolver.user(
      'volunteer-1',
      sessionFor('viewer-1'),
      ctx,
    );

    expect(result?.iban).toBe(MASKED_IBAN);
    expect(result?.accountHolder).toBe(MASKED_ACCOUNT_HOLDER);
    expect(result?.bic).toBe(MASKED_BIC);
    expect(result?.street).toBe('Musterstraße 1');
  });

  it('returns real bank data for a viewer with the accounting permission', async () => {
    authService.hasRequiredPermissions.mockResolvedValue(true);

    const result = await resolver.user(
      'volunteer-1',
      sessionFor('accountant-1'),
      ctx,
    );

    expect(result?.iban).toBe(volunteer.iban);
    expect(result?.accountHolder).toBe(volunteer.accountHolder);
    expect(result?.bic).toBe(volunteer.bic);
  });

  it('returns real bank data to the volunteer themself without a permission check', async () => {
    const result = await resolver.user(
      'volunteer-1',
      sessionFor('volunteer-1'),
      ctx,
    );

    expect(result?.iban).toBe(volunteer.iban);
    expect(result?.accountHolder).toBe(volunteer.accountHolder);
    expect(result?.bic).toBe(volunteer.bic);
    expect(authService.hasRequiredPermissions).not.toHaveBeenCalled();
  });

  it('does not invent masked values when no bank data exists', async () => {
    userService.findByIdInOrgUnit.mockResolvedValue({
      ...volunteer,
      iban: null,
      bic: null,
      accountHolder: null,
    });
    authService.hasRequiredPermissions.mockResolvedValue(false);

    const result = await resolver.user(
      'volunteer-1',
      sessionFor('viewer-1'),
      ctx,
    );

    expect(result?.iban).toBeNull();
    expect(result?.bic).toBeNull();
  });

  it('checks the accounting permission for the viewer in the org unit', async () => {
    authService.hasRequiredPermissions.mockResolvedValue(true);

    await resolver.user('volunteer-1', sessionFor('viewer-1'), ctx);

    expect(authService.hasRequiredPermissions).toHaveBeenCalledWith(
      'viewer-1',
      'unit-1',
      [PERMISSIONS.ACCOUNTING_MANAGE],
    );
  });

  it('returns null when the target is not in the org unit', async () => {
    userService.findByIdInOrgUnit.mockResolvedValue(undefined);

    const result = await resolver.user(
      'stranger-1',
      sessionFor('viewer-1'),
      ctx,
    );

    expect(result).toBeNull();
  });
});

describe('UserQueryResolver.me', () => {
  it('returns the volunteer their own bank data unmasked', async () => {
    const userService = {
      findByIdOrThrow: mock(() => Promise.resolve(volunteer)),
    };
    const resolver = new UserQueryResolver(
      userService as unknown as UserService,
      new UserMapper(),
      {} as unknown as AuthService,
    );

    const result = await resolver.me(sessionFor('volunteer-1'));

    expect(result.iban).toBe(volunteer.iban);
    expect(result.bic).toBe(volunteer.bic);
  });
});
