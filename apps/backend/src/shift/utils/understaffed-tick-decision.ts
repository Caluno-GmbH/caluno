export interface UnderstaffedTickInput {
  belowMinimum: boolean;
  hoursUntilStart: number;
  callOutAlreadyFired: boolean;
  reminderAlreadyFired: boolean;
  reminderThresholdHours: number;
  automationEnabled: boolean;
  isActiveDay: boolean;
  leadTimeHours: number | null;
}

export interface UnderstaffedTickDecision {
  /** True when the instance is back at/above minimum: the call-out re-arms (its "fired" state is cleared) for the next crossing. */
  rearm: boolean;
  fireCallOut: boolean;
  fireReminder: boolean;
}

/**
 * Pure state-transition logic for one instance on one scheduler tick — the
 * single hourly poll is the only trigger path (no event-driven dropout
 * hook), so this function is the whole rulebook for when the call-out and the
 * manager reminder fire, re-fire, or stay silent.
 *
 * Both are gated on the org unit's automatic urgent call automation: a unit
 * that has not switched it on gets neither.
 */
export function decideUnderstaffedTick(
  input: UnderstaffedTickInput,
): UnderstaffedTickDecision {
  if (!input.belowMinimum) {
    return { rearm: true, fireCallOut: false, fireReminder: false };
  }

  const { leadTimeHours } = input;
  if (!input.automationEnabled || !input.isActiveDay || leadTimeHours == null) {
    return { rearm: false, fireCallOut: false, fireReminder: false };
  }

  const fireCallOut =
    !input.callOutAlreadyFired && input.hoursUntilStart <= leadTimeHours;
  const fireReminder =
    !input.reminderAlreadyFired &&
    input.hoursUntilStart <= input.reminderThresholdHours;

  return { rearm: false, fireCallOut, fireReminder };
}
