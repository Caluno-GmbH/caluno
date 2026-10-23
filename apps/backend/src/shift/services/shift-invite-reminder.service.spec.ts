import { describe, expect, it } from 'bun:test';
import { ShiftInviteStatus } from '../enums';
import { ShiftInviteReminderService } from './shift-invite-reminder.service';

const ORG_UNIT_ID = 'org-1';
const INSTANCE_ID = 'instance-1';
const MASTER_ID = 'master-1';
const VOLUNTEER_ID = 'vol-1';
const ACTOR_ID = 'manager-1';

function makeInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: INSTANCE_ID,
    masterId: MASTER_ID,
    isCancelled: false,
    actualStartsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    actualEndsAt: new Date(Date.now() + 28 * 60 * 60 * 1000),
    overrideTitle: null,
    overrideLocation: null,
    master: {
      id: MASTER_ID,
      title: 'Food Distribution',
      location: 'Main Hall',
      instructions: 'Bring gloves',
      organizationUnitId: ORG_UNIT_ID,
    },
    ...overrides,
  };
}

function setup(options?: {
  invite?: { status?: ShiftInviteStatus; remindedAt?: Date | null };
  instance?: Record<string, unknown>;
  enqueueError?: Error;
  stampMatchesNothing?: boolean;
}) {
  const updates: Array<{ set: Record<string, unknown> }> = [];
  const sentEmails: Array<{ to: string; subject: string; html: string }> = [];
  const captures: Array<{ event: string; userId: string }> = [];
  const enqueueExecutors: unknown[] = [];

  const invite = {
    id: 'invite-1',
    instanceId: INSTANCE_ID,
    userId: VOLUNTEER_ID,
    status: options?.invite?.status ?? ShiftInviteStatus.ADMIN_INVITED,
    remindedAt: options?.invite?.remindedAt ?? null,
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
  };

  const makeUpdate =
    (target: Array<{ set: Record<string, unknown> }>) => () => ({
      set: (set: Record<string, unknown>) => {
        target.push({ set });
        return {
          where: () => ({
            returning: async () =>
              options?.stampMatchesNothing
                ? []
                : [{ remindedAt: set.remindedAt }],
          }),
        };
      },
    });
  const transactionExecutor = { update: makeUpdate([]) };

  const db = {
    query: {
      shiftInstanceInvites: {
        findFirst: async () => invite,
      },
      organizationUnits: {
        findFirst: async () => ({
          id: ORG_UNIT_ID,
          name: 'Playground',
          organizationId: 'org-root',
        }),
      },
    },
    transaction: async <T>(
      run: (tx: typeof transactionExecutor) => Promise<T>,
    ): Promise<T> => {
      const pendingUpdates: Array<{ set: Record<string, unknown> }> = [];
      transactionExecutor.update = makeUpdate(pendingUpdates);
      const result = await run(transactionExecutor);
      updates.push(...pendingUpdates);
      return result;
    },
  };

  const shiftService = {
    findInstanceById: async () => makeInstance(options?.instance),
  };

  const notificationService = {
    resolveUserNotificationData: async () => ({
      userId: VOLUNTEER_ID,
      name: 'Vol One',
      email: 'vol@example.com',
      firstName: 'Vol',
      locale: 'en',
    }),
  };

  const emailOutbox = {
    enqueue: async (
      email: { to: string; subject: string; html: string },
      executor?: unknown,
    ) => {
      enqueueExecutors.push(executor);
      if (options?.enqueueError) {
        throw options.enqueueError;
      }
      sentEmails.push(email);
      return { id: `outbox-${sentEmails.length}` };
    },
  };

  const appI18n = {
    createTranslator: () => ({ t: (key: string) => key }),
  };

  const postHogService = {
    capture: (input: { event: string; userId: string }) => {
      captures.push(input);
    },
  };

  const service = new ShiftInviteReminderService(
    db as never,
    shiftService as never,
    notificationService as never,
    emailOutbox as never,
    appI18n as never,
    postHogService as never,
  );

  return {
    service,
    updates,
    sentEmails,
    captures,
    enqueueExecutors,
    transactionExecutor,
  };
}

describe('ShiftInviteReminderService.sendInviteReminder', () => {
  it('emails the one invited volunteer and stamps remindedAt', async () => {
    const { service, sentEmails, updates, captures } = setup();

    const remindedAt = await service.sendInviteReminder(
      INSTANCE_ID,
      VOLUNTEER_ID,
      ORG_UNIT_ID,
      ACTOR_ID,
    );

    expect(remindedAt).toBeInstanceOf(Date);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe('vol@example.com');
    expect(sentEmails[0]?.html.length).toBeGreaterThan(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.set.remindedAt).toBeInstanceOf(Date);
    expect(captures).toHaveLength(1);
    expect(captures[0]?.event).toBe('shift_instance_invite_send');
    expect(captures[0]?.userId).toBe(ACTOR_ID);
  });

  it('rejects an invite that is no longer unanswered', async () => {
    const { service, sentEmails } = setup({
      invite: { status: ShiftInviteStatus.JOINED },
    });

    await expect(
      service.sendInviteReminder(
        INSTANCE_ID,
        VOLUNTEER_ID,
        ORG_UNIT_ID,
        ACTOR_ID,
      ),
    ).rejects.toThrow(/unanswered/);
    expect(sentEmails).toHaveLength(0);
  });

  it('rejects a volunteer who was already reminded', async () => {
    const { service, sentEmails } = setup({
      invite: { remindedAt: new Date('2026-09-01T10:00:00.000Z') },
    });

    await expect(
      service.sendInviteReminder(
        INSTANCE_ID,
        VOLUNTEER_ID,
        ORG_UNIT_ID,
        ACTOR_ID,
      ),
    ).rejects.toThrow(/already been reminded/);
    expect(sentEmails).toHaveLength(0);
  });

  it('rejects a cancelled shift instance', async () => {
    const { service, sentEmails } = setup({ instance: { isCancelled: true } });

    await expect(
      service.sendInviteReminder(
        INSTANCE_ID,
        VOLUNTEER_ID,
        ORG_UNIT_ID,
        ACTOR_ID,
      ),
    ).rejects.toThrow(/cancelled/);
    expect(sentEmails).toHaveLength(0);
  });

  it('rejects a past shift instance', async () => {
    const { service, sentEmails } = setup({
      instance: {
        actualStartsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        actualEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    await expect(
      service.sendInviteReminder(
        INSTANCE_ID,
        VOLUNTEER_ID,
        ORG_UNIT_ID,
        ACTOR_ID,
      ),
    ).rejects.toThrow(/past/);
    expect(sentEmails).toHaveLength(0);
  });

  it('still sends a reminder while the shift is in progress', async () => {
    const { service, sentEmails } = setup({
      instance: {
        actualStartsAt: new Date(Date.now() - 60 * 60 * 1000),
        actualEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await service.sendInviteReminder(
      INSTANCE_ID,
      VOLUNTEER_ID,
      ORG_UNIT_ID,
      ACTOR_ID,
    );

    expect(sentEmails).toHaveLength(1);
  });

  it('does not stamp remindedAt when the email fails', async () => {
    const { service, updates } = setup({
      enqueueError: new Error('outbox insert failed'),
    });

    await expect(
      service.sendInviteReminder(
        INSTANCE_ID,
        VOLUNTEER_ID,
        ORG_UNIT_ID,
        ACTOR_ID,
      ),
    ).rejects.toThrow('outbox insert failed');
    expect(updates).toHaveLength(0);
  });

  it('queues the email in the stamping transaction', async () => {
    const { service, enqueueExecutors, transactionExecutor } = setup();

    await service.sendInviteReminder(
      INSTANCE_ID,
      VOLUNTEER_ID,
      ORG_UNIT_ID,
      ACTOR_ID,
    );

    expect(enqueueExecutors).toEqual([transactionExecutor]);
  });

  it('queues nothing when the invite was answered or reminded meanwhile', async () => {
    const { service, sentEmails, updates } = setup({
      stampMatchesNothing: true,
    });

    await expect(
      service.sendInviteReminder(
        INSTANCE_ID,
        VOLUNTEER_ID,
        ORG_UNIT_ID,
        ACTOR_ID,
      ),
    ).rejects.toThrow(/already been answered or reminded/);
    expect(sentEmails).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});
