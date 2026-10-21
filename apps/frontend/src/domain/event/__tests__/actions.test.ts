import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { CreateShiftInput } from '@repo/data';

const deleteMock = mock(async (_id: string) => ({ id: 'event-1' }));
const createShiftMock = mock(async (_input: CreateShiftInput) => ({
  id: 'shift-1',
}));
const findInstancesMock = mock(
  async (_shiftId: string) =>
    [] as Array<{ id: string; actualStartsAt: string }>,
);
const revalidatePathMock = mock((_path: string) => undefined);

mock.module('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

mock.module('@/lib/data-client', () => ({
  getDataClient: async () => ({
    event: {
      delete: deleteMock,
    },
    shift: {
      create: createShiftMock,
      findInstances: findInstancesMock,
    },
  }),
}));

const { createEventShift, deleteEvent } = await import('../actions');

const validCreateInput = {
  name: 'Morning shift',
  startsAt: new Date('2026-06-24T08:00:00.000Z'),
  endsAt: new Date('2026-06-24T12:00:00.000Z'),
  invitedMemberIds: [] as string[],
};

describe('deleteEvent', () => {
  it('deletes the event via the data client', async () => {
    const result = await deleteEvent('org-1', 'event-1', {});
    expect(result.data).toEqual({ id: 'event-1' });
    expect(deleteMock).toHaveBeenCalledWith('event-1');
  });
});

describe('createEventShift', () => {
  beforeEach(() => {
    findInstancesMock.mockReset();
  });

  it('returns the week of the earliest instance as focusWeek', async () => {
    findInstancesMock.mockResolvedValue([
      { id: 'instance-later', actualStartsAt: '2026-10-06T08:00:00.000Z' },
      { id: 'instance-first', actualStartsAt: '2026-09-13T18:00:00.000Z' },
    ]);

    const result = await createEventShift('org-1', 'event-1', validCreateInput);

    expect(result.data).toEqual({
      id: 'shift-1',
      instanceId: 'instance-first',
      focusWeek: { eventId: 'event-1', week: '2026-09-07' },
    });
  });

  it('leaves focusWeek out when the shift has no instances', async () => {
    findInstancesMock.mockResolvedValue([]);

    const result = await createEventShift('org-1', 'event-1', validCreateInput);

    expect(result.data?.focusWeek).toBeUndefined();
  });
});
