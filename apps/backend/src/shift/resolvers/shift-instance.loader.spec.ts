jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'abcdefghijkl',
}));

import type { ShiftCallOutService } from '../services/shift-call-out.service';
import type { ShiftService } from '../shift.service';
import { ShiftInstanceLoader } from './shift-instance.loader';

const shiftCallOutServiceStub = {
  getLastCallOutSummaries: jest.fn().mockResolvedValue(new Map()),
} as unknown as ShiftCallOutService;

describe('ShiftInstanceLoader', () => {
  describe('myInvitedAtByKey', () => {
    it('returns the createdAt for a matching instance and user', async () => {
      const createdAt = new Date('2026-08-12T10:00:00Z');
      const findInviteStatusesForUser = jest
        .fn()
        .mockResolvedValue([
          { shiftInstanceId: 'instance-1', status: 'INVITED', createdAt },
        ]);
      const loader = new ShiftInstanceLoader(
        { findInviteStatusesForUser } as unknown as ShiftService,
        shiftCallOutServiceStub,
      );

      const result = await loader.myInvitedAtByKey.load('instance-1:user-1');

      expect(result).toEqual(createdAt);
      expect(findInviteStatusesForUser).toHaveBeenCalledWith('user-1', [
        'instance-1',
      ]);
    });

    it('returns null when the user has no invite for the instance', async () => {
      const findInviteStatusesForUser = jest.fn().mockResolvedValue([]);
      const loader = new ShiftInstanceLoader(
        { findInviteStatusesForUser } as unknown as ShiftService,
        shiftCallOutServiceStub,
      );

      const result = await loader.myInvitedAtByKey.load('instance-1:user-1');

      expect(result).toBeNull();
    });

    it('batches multiple loads for the same user into one service call', async () => {
      const createdAt1 = new Date('2026-08-01T00:00:00Z');
      const createdAt2 = new Date('2026-08-02T00:00:00Z');
      const findInviteStatusesForUser = jest.fn().mockResolvedValue([
        {
          shiftInstanceId: 'instance-1',
          status: 'INVITED',
          createdAt: createdAt1,
        },
        {
          shiftInstanceId: 'instance-2',
          status: 'INVITED',
          createdAt: createdAt2,
        },
      ]);
      const loader = new ShiftInstanceLoader(
        { findInviteStatusesForUser } as unknown as ShiftService,
        shiftCallOutServiceStub,
      );

      const [result1, result2] = await Promise.all([
        loader.myInvitedAtByKey.load('instance-1:user-1'),
        loader.myInvitedAtByKey.load('instance-2:user-1'),
      ]);

      expect(result1).toEqual(createdAt1);
      expect(result2).toEqual(createdAt2);
      expect(findInviteStatusesForUser).toHaveBeenCalledTimes(1);
      expect(findInviteStatusesForUser).toHaveBeenCalledWith('user-1', [
        'instance-1',
        'instance-2',
      ]);
    });
  });

  describe('timeEntriesByKey', () => {
    it('returns the entries for a matching org unit and instance', async () => {
      const entry = {
        id: 'entry-1',
        shiftInstanceId: 'instance-1',
        startedAt: new Date('2026-09-02T08:00:00.000Z'),
        endedAt: null,
      };
      const findTimeEntriesForInstances = jest.fn().mockResolvedValue([entry]);
      const loader = new ShiftInstanceLoader(
        { findTimeEntriesForInstances } as unknown as ShiftService,
        shiftCallOutServiceStub,
      );

      const result = await loader.timeEntriesByKey.load('ou-1:instance-1');

      expect(result).toEqual([entry]);
      expect(findTimeEntriesForInstances).toHaveBeenCalledWith(
        ['instance-1'],
        'ou-1',
      );
    });

    it('returns an empty array when the instance has no entries', async () => {
      const findTimeEntriesForInstances = jest.fn().mockResolvedValue([]);
      const loader = new ShiftInstanceLoader(
        { findTimeEntriesForInstances } as unknown as ShiftService,
        shiftCallOutServiceStub,
      );

      const result = await loader.timeEntriesByKey.load('ou-1:instance-1');

      expect(result).toEqual([]);
    });

    it('batches multiple instance loads into one service call, grouped correctly', async () => {
      const entryA = {
        id: 'entry-a',
        shiftInstanceId: 'instance-1',
        startedAt: new Date('2026-09-02T08:00:00.000Z'),
        endedAt: null,
      };
      const entryB = {
        id: 'entry-b',
        shiftInstanceId: 'instance-2',
        startedAt: new Date('2026-09-03T08:00:00.000Z'),
        endedAt: null,
      };
      const findTimeEntriesForInstances = jest
        .fn()
        .mockResolvedValue([entryA, entryB]);
      const loader = new ShiftInstanceLoader(
        { findTimeEntriesForInstances } as unknown as ShiftService,
        shiftCallOutServiceStub,
      );

      const [result1, result2] = await Promise.all([
        loader.timeEntriesByKey.load('ou-1:instance-1'),
        loader.timeEntriesByKey.load('ou-1:instance-2'),
      ]);

      expect(result1).toEqual([entryA]);
      expect(result2).toEqual([entryB]);
      expect(findTimeEntriesForInstances).toHaveBeenCalledTimes(1);
      expect(findTimeEntriesForInstances).toHaveBeenCalledWith(
        ['instance-1', 'instance-2'],
        'ou-1',
      );
    });

    it('scopes each org unit to its own service call', async () => {
      const entryA = {
        id: 'entry-a',
        shiftInstanceId: 'instance-1',
        startedAt: new Date('2026-09-02T08:00:00.000Z'),
        endedAt: null,
      };
      const findTimeEntriesForInstances = jest
        .fn()
        .mockImplementation((_ids: string[], orgUnitId: string) =>
          Promise.resolve(orgUnitId === 'ou-1' ? [entryA] : []),
        );
      const loader = new ShiftInstanceLoader(
        { findTimeEntriesForInstances } as unknown as ShiftService,
        shiftCallOutServiceStub,
      );

      const [result1, result2] = await Promise.all([
        loader.timeEntriesByKey.load('ou-1:instance-1'),
        loader.timeEntriesByKey.load('ou-2:instance-1'),
      ]);

      expect(result1).toEqual([entryA]);
      expect(result2).toEqual([]);
      expect(findTimeEntriesForInstances).toHaveBeenCalledTimes(2);
      expect(findTimeEntriesForInstances).toHaveBeenCalledWith(
        ['instance-1'],
        'ou-1',
      );
      expect(findTimeEntriesForInstances).toHaveBeenCalledWith(
        ['instance-1'],
        'ou-2',
      );
    });
  });
});
