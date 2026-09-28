jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'abcdefghijkl',
}));

jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => jest.fn(),
  Session: () => jest.fn(),
}));

import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { ShiftInstanceEntity } from '../schemas/shift-instance.schema';
import type { ShiftLoader } from './shift.loader';
import type { ShiftInstanceLoader } from './shift-instance.loader';
import { ShiftInstanceFieldResolver } from './shift-instance-field.resolver';

const instance = (
  overrides: Partial<ShiftInstanceEntity> = {},
): ShiftInstanceEntity =>
  ({ id: 'instance-1', ...overrides }) as ShiftInstanceEntity;

const newResolver = () =>
  new ShiftInstanceFieldResolver(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

describe('ShiftInstanceFieldResolver', () => {
  describe('myInvitedAt', () => {
    it('returns null without loading when there is no session user', async () => {
      const resolver = newResolver();
      const load = jest.fn();
      const loader = {
        myInvitedAtByKey: { load },
      } as unknown as ShiftInstanceLoader;

      const result = await resolver.myInvitedAt(
        instance({ id: 'instance-1' }),
        null as unknown as UserSession,
        loader,
      );

      expect(result).toBeNull();
      expect(load).not.toHaveBeenCalled();
    });

    it('loads the invited-at date keyed by instance and user', async () => {
      const resolver = newResolver();
      const createdAt = new Date('2026-08-12T10:00:00Z');
      const load = jest.fn().mockResolvedValue(createdAt);
      const loader = {
        myInvitedAtByKey: { load },
      } as unknown as ShiftInstanceLoader;
      const session = { user: { id: 'user-1' } } as UserSession;

      const result = await resolver.myInvitedAt(
        instance({ id: 'instance-1' }),
        session,
        loader,
      );

      expect(result).toEqual(createdAt);
      expect(load).toHaveBeenCalledWith('instance-1:user-1');
    });
  });

  describe('timeEntries', () => {
    it('loads time entries keyed by org unit and instance id', async () => {
      const resolver = newResolver();
      const entries = [
        {
          id: 'entry-1',
          shiftInstanceId: 'instance-1',
          startedAt: new Date('2026-09-02T08:00:00.000Z'),
          endedAt: null,
        },
      ];
      const load = jest.fn().mockResolvedValue(entries);
      const loader = {
        timeEntriesByKey: { load },
      } as unknown as ShiftInstanceLoader;
      const context = { organizationUnitId: 'ou-1' } as never;

      const result = await resolver.timeEntries(
        instance({ id: 'instance-1' }),
        context,
        loader,
      );

      expect(result).toEqual(entries);
      expect(load).toHaveBeenCalledWith('ou-1:instance-1');
    });
  });

  describe('reimbursementTypeKey', () => {
    it('resolves the occurrence override without loading the master shift', async () => {
      const resolver = newResolver();
      const shiftLoad = jest.fn();
      const keyLoad = jest.fn().mockResolvedValue('EHRENAMT');
      const loader = {
        shiftById: { load: shiftLoad },
        reimbursementTypeKeyById: { load: keyLoad },
      } as unknown as ShiftLoader;

      const result = await resolver.reimbursementTypeKey(
        instance({
          id: 'instance-1',
          overrideReimbursementTypeId: 'rt-override',
        }),
        loader,
      );

      expect(result).toBe('EHRENAMT');
      expect(keyLoad).toHaveBeenCalledWith('rt-override');
      expect(shiftLoad).not.toHaveBeenCalled();
    });

    it('falls back to the master shift type when there is no override', async () => {
      const resolver = newResolver();
      const shiftLoad = jest
        .fn()
        .mockResolvedValue({ reimbursementTypeId: 'rt-master' });
      const keyLoad = jest.fn().mockResolvedValue('UEBUNGSLEITER');
      const loader = {
        shiftById: { load: shiftLoad },
        reimbursementTypeKeyById: { load: keyLoad },
      } as unknown as ShiftLoader;

      const result = await resolver.reimbursementTypeKey(
        instance({
          id: 'instance-1',
          masterId: 'shift-1',
          overrideReimbursementTypeId: null,
        }),
        loader,
      );

      expect(result).toBe('UEBUNGSLEITER');
      expect(shiftLoad).toHaveBeenCalledWith('shift-1');
      expect(keyLoad).toHaveBeenCalledWith('rt-master');
    });

    it('returns null without resolving a key when the occurrence is unpaid', async () => {
      const resolver = newResolver();
      const shiftLoad = jest
        .fn()
        .mockResolvedValue({ reimbursementTypeId: null });
      const keyLoad = jest.fn();
      const loader = {
        shiftById: { load: shiftLoad },
        reimbursementTypeKeyById: { load: keyLoad },
      } as unknown as ShiftLoader;

      const result = await resolver.reimbursementTypeKey(
        instance({
          id: 'instance-1',
          masterId: 'shift-1',
          overrideReimbursementTypeId: null,
        }),
        loader,
      );

      expect(result).toBeNull();
      expect(keyLoad).not.toHaveBeenCalled();
    });
  });
});
