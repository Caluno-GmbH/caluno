import { describe, expect, it } from 'bun:test';
import {
  decideUnderstaffedTick,
  type UnderstaffedTickInput,
} from './understaffed-tick-decision';

function makeInput(
  overrides: Partial<UnderstaffedTickInput> = {},
): UnderstaffedTickInput {
  return {
    belowMinimum: true,
    hoursUntilStart: 40,
    callOutAlreadyFired: false,
    reminderAlreadyFired: false,
    reminderThresholdHours: 24,
    automationEnabled: true,
    isActiveDay: true,
    leadTimeHours: 48,
    ...overrides,
  };
}

describe('decideUnderstaffedTick', () => {
  it('fires the call-out on the first below-minimum tick (AC1/AC3)', () => {
    const decision = decideUnderstaffedTick(makeInput());
    expect(decision).toEqual({
      rearm: false,
      fireCallOut: true,
      fireReminder: false,
    });
  });

  it('does not refire the call-out on a later tick still in the same below-minimum run (AC5)', () => {
    const decision = decideUnderstaffedTick(
      makeInput({ callOutAlreadyFired: true }),
    );
    expect(decision.fireCallOut).toBe(false);
  });

  it('re-arms once the instance is back at/above minimum (AC4, part 1)', () => {
    const decision = decideUnderstaffedTick(
      makeInput({ belowMinimum: false, callOutAlreadyFired: true }),
    );
    expect(decision).toEqual({
      rearm: true,
      fireCallOut: false,
      fireReminder: false,
    });
  });

  it('fires the call-out again on a fresh crossing after re-arming (AC4, part 2)', () => {
    // callOutAlreadyFired: false simulates the re-armed state persisted from
    // the previous re-arm tick.
    const decision = decideUnderstaffedTick(
      makeInput({ belowMinimum: true, callOutAlreadyFired: false }),
    );
    expect(decision.fireCallOut).toBe(true);
  });

  it('an instance never below minimum never fires (AC6)', () => {
    const decision = decideUnderstaffedTick(makeInput({ belowMinimum: false }));
    expect(decision.fireCallOut).toBe(false);
    expect(decision.fireReminder).toBe(false);
  });

  it('fires the reminder once still below minimum inside the 24h window (AC7)', () => {
    const decision = decideUnderstaffedTick(
      makeInput({ hoursUntilStart: 20, callOutAlreadyFired: true }),
    );
    expect(decision.fireReminder).toBe(true);
  });

  it('does not refire the reminder on a later tick within the same 24h window', () => {
    const decision = decideUnderstaffedTick(
      makeInput({
        hoursUntilStart: 10,
        callOutAlreadyFired: true,
        reminderAlreadyFired: true,
      }),
    );
    expect(decision.fireReminder).toBe(false);
  });

  it('does not fire the reminder while still outside the 24h window', () => {
    const decision = decideUnderstaffedTick(
      makeInput({ hoursUntilStart: 30, callOutAlreadyFired: true }),
    );
    expect(decision.fireReminder).toBe(false);
  });

  it('sends nothing if the shift is filled by the 24h mark (AC8)', () => {
    const decision = decideUnderstaffedTick(
      makeInput({
        belowMinimum: false,
        hoursUntilStart: 20,
        callOutAlreadyFired: true,
      }),
    );
    expect(decision.fireCallOut).toBe(false);
    expect(decision.fireReminder).toBe(false);
  });

  it('fires the call-out and reminder in the same tick for a late-only drop inside the final 24h', () => {
    const decision = decideUnderstaffedTick(makeInput({ hoursUntilStart: 10 }));
    expect(decision.fireCallOut).toBe(true);
    expect(decision.fireReminder).toBe(true);
  });

  describe('automatic urgent call automation (VOLI-1487)', () => {
    it('stays silent for a unit that has not switched the automation on', () => {
      const decision = decideUnderstaffedTick(
        makeInput({ automationEnabled: false, hoursUntilStart: 10 }),
      );
      expect(decision).toEqual({
        rearm: false,
        fireCallOut: false,
        fireReminder: false,
      });
    });

    it('stays silent for a shift falling outside the active days', () => {
      const decision = decideUnderstaffedTick(
        makeInput({ isActiveDay: false, hoursUntilStart: 10 }),
      );
      expect(decision.fireCallOut).toBe(false);
      expect(decision.fireReminder).toBe(false);
    });

    it('stays silent when no lead time is configured', () => {
      const decision = decideUnderstaffedTick(
        makeInput({ leadTimeHours: null, hoursUntilStart: 10 }),
      );
      expect(decision.fireCallOut).toBe(false);
    });

    it('waits until the shift is inside the chosen lead time', () => {
      expect(
        decideUnderstaffedTick(
          makeInput({ leadTimeHours: 12, hoursUntilStart: 13 }),
        ).fireCallOut,
      ).toBe(false);
      expect(
        decideUnderstaffedTick(
          makeInput({ leadTimeHours: 12, hoursUntilStart: 12 }),
        ).fireCallOut,
      ).toBe(true);
    });

    it('honours a longer lead time than the old fixed 48 hours', () => {
      expect(
        decideUnderstaffedTick(
          makeInput({ leadTimeHours: 72, hoursUntilStart: 60 }),
        ).fireCallOut,
      ).toBe(true);
    });

    it('still re-arms when back at minimum even with the automation off', () => {
      const decision = decideUnderstaffedTick(
        makeInput({ belowMinimum: false, automationEnabled: false }),
      );
      expect(decision.rearm).toBe(true);
    });
  });
});
