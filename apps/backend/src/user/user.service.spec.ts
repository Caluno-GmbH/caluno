import { NotFoundGraphQLError } from '../graphql/errors';
import { UserService } from './user.service';

describe('UserService.resolveVolunteerIdByCheckInId', () => {
  const serviceWith = (user: { id: string } | undefined) => {
    const findFirst = jest.fn().mockResolvedValue(user);
    const service = new UserService(
      { query: { users: { findFirst } } } as never,
      {} as never,
    );
    return { service, findFirst };
  };

  it('returns the user id for a known check-in id', async () => {
    const { service, findFirst } = serviceWith({ id: 'user-1' });

    expect(await service.resolveVolunteerIdByCheckInId('qr-1')).toBe('user-1');
    expect(findFirst).toHaveBeenCalledWith({ where: { checkInId: 'qr-1' } });
  });

  it('throws Volunteer not found for an unknown check-in id', async () => {
    const { service } = serviceWith(undefined);

    const result = service.resolveVolunteerIdByCheckInId('unknown');

    await expect(result).rejects.toBeInstanceOf(NotFoundGraphQLError);
    await expect(result).rejects.toThrow('Volunteer not found');
  });
});
