import { describe, expect, it } from 'bun:test';
import { recurrenceLabelKey } from './recurrence-label';

describe('recurrenceLabelKey', () => {
  it('returns null without a recurring rule', () => {
    expect(recurrenceLabelKey(null)).toBeNull();
    expect(recurrenceLabelKey('FREQ=DAILY;COUNT=1')).toBeNull();
  });

  it('labels a series on some weekdays as weekly', () => {
    expect(recurrenceLabelKey('FREQ=WEEKLY;BYDAY=MO,WE;WKST=MO')).toBe(
      'weekly',
    );
  });

  it('labels a series on all seven days as daily', () => {
    expect(
      recurrenceLabelKey(
        'DTSTART:20261120T080000Z\nFREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;UNTIL=20261231T000000Z',
      ),
    ).toBe('daily');
  });
});
