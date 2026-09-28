import { PERMISSIONS } from '../../auth/constants';
import type { OrganizationUnitEntity } from '../../organization/schemas/organization-unit.schema';
import type { MembershipRequestEntity } from '../schemas/membership-request.schema';
import { MembershipRequestFieldResolver } from './membership-request-field.resolver';

const request = (
  overrides: Partial<MembershipRequestEntity> & {
    organizationUnit?: { id: string } | null;
  } = {},
) =>
  ({
    id: 'request-1',
    userId: 'user-1',
    organizationUnitId: 'unit-1',
    status: 'PENDING',
    organizationUnit: { id: 'unit-1' },
    ...overrides,
  }) as MembershipRequestEntity & {
    organizationUnit?: { id: string } | null;
  };

const organizationUnit = (
  overrides: Partial<OrganizationUnitEntity> = {},
): OrganizationUnitEntity =>
  ({
    id: 'unit-1',
    name: 'Acme Unit',
    slug: 'acme-unit',
    organizationId: 'org-1',
    typeId: 'type-1',
    contactPersonName: null,
    contactEmail: null,
    phone: null,
    welcomeMessage: null,
    ...overrides,
  }) as OrganizationUnitEntity;

const newResolver = (deps: {
  findOrganizationUnitById?: jest.Mock;
  findUsersWithPermission?: jest.Mock;
  findUserById?: jest.Mock;
}) =>
  new MembershipRequestFieldResolver(
    {
      findUsersWithPermission:
        deps.findUsersWithPermission ?? jest.fn().mockResolvedValue([]),
    } as never,
    {
      findById: deps.findUserById ?? jest.fn().mockResolvedValue(undefined),
    } as never,
    {
      findById:
        deps.findOrganizationUnitById ?? jest.fn().mockResolvedValue(undefined),
    } as never,
  );

describe('MembershipRequestFieldResolver', () => {
  describe('contact', () => {
    it('returns null when the request has no organization unit', async () => {
      const resolver = newResolver({});

      const result = await resolver.contact(
        request({ organizationUnit: null, organizationUnitId: 'unit-1' }),
      );

      expect(result).toBeNull();
    });

    it('returns configured org-unit contact when present', async () => {
      const findOrganizationUnitById = jest.fn().mockResolvedValue(
        organizationUnit({
          contactPersonName: 'Alex Contact',
          contactEmail: 'alex@example.org',
          phone: '+49 30 123456',
        }),
      );
      const findUsersWithPermission = jest.fn();
      const resolver = newResolver({
        findOrganizationUnitById,
        findUsersWithPermission,
      });

      const result = await resolver.contact(request());

      expect(result).toEqual({
        name: 'Alex Contact',
        email: 'alex@example.org',
        phone: '+49 30 123456',
      });
      expect(findUsersWithPermission).not.toHaveBeenCalled();
    });

    it('falls back to the first volunteer admin when org-unit contact is unset', async () => {
      const findOrganizationUnitById = jest
        .fn()
        .mockResolvedValue(organizationUnit());
      const findUsersWithPermission = jest
        .fn()
        .mockResolvedValue([{ id: 'admin-1' }]);
      const findUserById = jest.fn().mockResolvedValue({
        id: 'admin-1',
        name: 'Admin User',
        email: 'admin@example.org',
      });
      const resolver = newResolver({
        findOrganizationUnitById,
        findUsersWithPermission,
        findUserById,
      });

      const result = await resolver.contact(request());

      expect(result).toEqual({
        name: 'Admin User',
        email: 'admin@example.org',
        phone: null,
      });
      expect(findUsersWithPermission).toHaveBeenCalledWith(
        'unit-1',
        PERMISSIONS.VOLUNTEER_EDIT,
      );
      expect(findUserById).toHaveBeenCalledWith('admin-1');
    });

    it('returns null when org-unit contact is unset and no admin is found', async () => {
      const findOrganizationUnitById = jest
        .fn()
        .mockResolvedValue(organizationUnit());
      const findUsersWithPermission = jest.fn().mockResolvedValue([]);
      const resolver = newResolver({
        findOrganizationUnitById,
        findUsersWithPermission,
      });

      const result = await resolver.contact(request());

      expect(result).toBeNull();
    });
  });
});
