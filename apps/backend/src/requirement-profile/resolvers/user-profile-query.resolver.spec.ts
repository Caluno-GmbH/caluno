import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { AuthService } from '../../auth/auth.service';
import { PERMISSIONS } from '../../auth/constants';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { UserProfileMapper } from '../mappers/user-profile.mapper';
import type { UserProfileEntity } from '../schemas/user-profile.schema';
import type { UserProfileService } from '../services';
import { UserProfileQueryResolver } from './user-profile-query.resolver';

const MASKED_IBAN = 'XXXX XXXX XXXX XXXX XXXX XX';
const MASKED_BIC = 'XXXXXXXXXXX';

const now = new Date('2026-09-15T08:00:00Z');

const profile = {
  id: 'profile-1',
  userId: 'volunteer-1',
  data: {
    address: 'Musterstraße 1',
    iban: 'DE89 3704 0044 0532 0130 00',
    bic: 'COBADEFFXXX',
  },
  createdAt: now,
  updatedAt: now,
} satisfies UserProfileEntity;

const ctx = { organizationUnitId: 'unit-1' } as AuthenticatedGraphQLContext;

const sessionFor = (userId: string) =>
  ({ user: { id: userId } }) as unknown as UserSession;

describe('UserProfileQueryResolver.adminUserProfile payment-data visibility', () => {
  let userProfileService: {
    findByUserIdInOrgUnit: jest.Mock;
    findByUserId: jest.Mock;
  };
  let authService: { hasRequiredPermissions: jest.Mock };
  let resolver: UserProfileQueryResolver;

  beforeEach(() => {
    userProfileService = {
      findByUserIdInOrgUnit: jest.fn().mockResolvedValue(profile),
      findByUserId: jest.fn().mockResolvedValue(profile),
    };
    authService = { hasRequiredPermissions: jest.fn() };
    resolver = new UserProfileQueryResolver(
      userProfileService as unknown as UserProfileService,
      new UserProfileMapper(),
      authService as unknown as AuthService,
    );
  });

  it('masks iban and bic for a viewer without the accounting permission', async () => {
    authService.hasRequiredPermissions.mockResolvedValue(false);

    const result = await resolver.adminUserProfile(
      'volunteer-1',
      sessionFor('viewer-1'),
      ctx,
    );

    expect(result?.data.iban).toBe(MASKED_IBAN);
    expect(result?.data.bic).toBe(MASKED_BIC);
    expect(result?.data.address).toBe('Musterstraße 1');
  });

  it('returns real bank data for a viewer with the accounting permission', async () => {
    authService.hasRequiredPermissions.mockResolvedValue(true);

    const result = await resolver.adminUserProfile(
      'volunteer-1',
      sessionFor('accountant-1'),
      ctx,
    );

    expect(result?.data.iban).toBe(profile.data.iban);
    expect(result?.data.bic).toBe(profile.data.bic);
  });

  it('returns real bank data to the volunteer themself without a permission check', async () => {
    const result = await resolver.adminUserProfile(
      'volunteer-1',
      sessionFor('volunteer-1'),
      ctx,
    );

    expect(result?.data.iban).toBe(profile.data.iban);
    expect(result?.data.bic).toBe(profile.data.bic);
    expect(authService.hasRequiredPermissions).not.toHaveBeenCalled();
  });

  it('does not invent masked values when no bank data exists', async () => {
    userProfileService.findByUserIdInOrgUnit.mockResolvedValue({
      ...profile,
      data: { address: 'Musterstraße 1' },
    });
    authService.hasRequiredPermissions.mockResolvedValue(false);

    const result = await resolver.adminUserProfile(
      'volunteer-1',
      sessionFor('viewer-1'),
      ctx,
    );

    expect(result?.data.iban).toBeUndefined();
    expect(result?.data.bic).toBeUndefined();
  });

