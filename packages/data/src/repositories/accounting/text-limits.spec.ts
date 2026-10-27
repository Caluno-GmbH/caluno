import { describe, expect, it } from 'bun:test';
import {
  exceedsManualFieldLimit,
  FREEFORM_TEXT_MAX_LENGTH,
  manualFieldMaxLength,
  TASK_DESCRIPTION_MAX_LENGTH,
} from './text-limits';

describe('manual field limits', () => {
  it('allows exactly the task limit and rejects one more', () => {
    expect(exceedsManualFieldLimit('tasks', 'x'.repeat(300))).toBe(false);
    expect(exceedsManualFieldLimit('tasks', 'x'.repeat(301))).toBe(true);
  });

  it('limits freeform text to 1000 characters', () => {
    expect(exceedsManualFieldLimit('freeform-text', 'x'.repeat(1000))).toBe(
      false,
    );
    expect(exceedsManualFieldLimit('freeform-text', 'x'.repeat(1001))).toBe(
      true,
    );
  });

  it('leaves other fields unlimited', () => {
    expect(exceedsManualFieldLimit('kostenstelle', 'x'.repeat(5000))).toBe(
      false,
    );
    expect(manualFieldMaxLength('kostenstelle')).toBeUndefined();
  });

  it('does not resolve inherited object keys to a limit', () => {
    expect(manualFieldMaxLength('constructor')).toBeUndefined();
  });

  it('exposes the limits as constants', () => {
    expect(TASK_DESCRIPTION_MAX_LENGTH).toBe(300);
    expect(FREEFORM_TEXT_MAX_LENGTH).toBe(1000);
    expect(manualFieldMaxLength('tasks')).toBe(300);
  });
});
