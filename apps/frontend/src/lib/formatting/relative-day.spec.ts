import { describe, expect, it } from 'bun:test';
import {
  formatAppliedWhen,
  formatDaysAway,
  formatStatusAge,
  formatUpcomingWhen,
  idsSharingTitleAndDay,
  STATUS_WARNING_AFTER_DAYS,
} from './relative-day';

const NOW = new Date('2026-10-07T12:00:00.000Z');
const TZ = 'Europe/Berlin';

/** Linux ICU inserts a comma after the weekday; macOS does not. */
function weekdayLabel(label: string | undefined): string | undefined {
  return label?.replace(',', '');
}

function upcoming(startsAt: string, endsAt: string, locale: string) {
  return formatUpcomingWhen(startsAt, endsAt, {
    locale,
    timeZone: TZ,
    now: NOW,
  });
}

function applied(at: string, locale: string) {
  const when = formatAppliedWhen(at, { locale, timeZone: TZ, now: NOW });
  if (!when) return undefined;
  if (locale === 'de') {
    const whenLabel =
      when.relative.charAt(0).toLocaleUpperCase('de-DE') +
      when.relative.slice(1);
    return `${whenLabel} beworben`;
  }
  return `Applied ${when.relative}`;
}

describe('formatUpcomingWhen', () => {
  const end = (start: string, hours: number) => {
    const date = new Date(start);
    date.setUTCHours(date.getUTCHours() + hours);
    return date.toISOString();
  };

  it('names today and tomorrow and colours them', () => {
    const today = upcoming(
      '2026-10-07T08:00:00.000Z',
      '2026-10-07T11:00:00.000Z',
      'en',
    );
    expect(today).toMatchObject({
      dayLabel: 'Today',
      dateLabel: 'Wed 7 Oct',
      startTime: '10:00',
      tone: 'danger',
    });
    expect(today?.relative).toBeUndefined();

    const tomorrow = upcoming(
      '2026-10-08T08:00:00.000Z',
      '2026-10-08T11:00:00.000Z',
      'en',
    );
    expect(tomorrow).toMatchObject({
      dayLabel: 'Tomorrow',
      startTime: '10:00',
      tone: 'warning',
    });

    expect(
      upcoming('2026-10-07T08:00:00.000Z', '2026-10-07T11:00:00.000Z', 'de')
        ?.dayLabel,
    ).toBe('Heute');
    expect(
      upcoming('2026-10-08T08:00:00.000Z', '2026-10-08T11:00:00.000Z', 'de')
        ?.dayLabel,
    ).toBe('Morgen');
  });

  it('adds a relative phrase within seven days', () => {
    const soon = upcoming(
      '2026-10-13T08:00:00.000Z',
      end('2026-10-13T08:00:00.000Z', 3),
      'en',
    );
    expect(soon).toMatchObject({
      dayLabel: 'Tue 13 Oct',
      startTime: '10:00',
      relative: 'in 6 days',
      tone: 'neutral',
    });
    expect(
      weekdayLabel(
        upcoming(
          '2026-10-13T08:00:00.000Z',
          end('2026-10-13T08:00:00.000Z', 3),
          'de',
        )?.dayLabel,
      ),
    ).toBe('Di. 13. Okt.');
    expect(
      upcoming(
        '2026-10-13T08:00:00.000Z',
        end('2026-10-13T08:00:00.000Z', 3),
        'de',
      )?.relative,
    ).toBe('in 6 Tagen');
  });

  it('drops the relative phrase later in the same year', () => {
    const later = upcoming(
      '2026-11-20T09:00:00.000Z',
      '2026-11-20T12:00:00.000Z',
      'en',
    );
    expect(later).toMatchObject({
      dayLabel: 'Fri 20 Nov',
      startTime: '10:00',
      tone: 'neutral',
    });
    expect(later?.relative).toBeUndefined();
    expect(
      weekdayLabel(
        upcoming('2026-11-20T09:00:00.000Z', '2026-11-20T12:00:00.000Z', 'de')
          ?.dayLabel,
      ),
    ).toBe('Fr. 20. Nov.');
  });

  it('includes the year when the start is in another year', () => {
    expect(
      upcoming('2027-10-13T08:00:00.000Z', '2027-10-13T11:00:00.000Z', 'en')
        ?.dayLabel,
    ).toBe('Wed, 13 Oct 2027');
    expect(
      weekdayLabel(
        upcoming('2027-10-13T08:00:00.000Z', '2027-10-13T11:00:00.000Z', 'de')
          ?.dayLabel,
      ),
    ).toBe('Mi. 13. Okt. 2027');
  });

  it('uses the org timezone around midnight', () => {
    const justBeforeBerlinMidnight = new Date('2026-10-07T21:30:00.000Z');
    const berlinNextDay = formatUpcomingWhen(
      '2026-10-07T22:30:00.000Z',
      '2026-10-08T01:30:00.000Z',
      { locale: 'en', timeZone: TZ, now: justBeforeBerlinMidnight },
    );
    expect(berlinNextDay?.dayLabel).toBe('Tomorrow');

    const afterBerlinMidnight = new Date('2026-10-07T22:30:00.000Z');
    const stillTonightInUtc = formatUpcomingWhen(
      '2026-10-07T20:00:00.000Z',
      '2026-10-07T21:00:00.000Z',
      { locale: 'en', timeZone: TZ, now: afterBerlinMidnight },
    );
    expect(stillTonightInUtc?.dayLabel).toBe('Yesterday');
  });
});

describe('formatAppliedWhen', () => {
  it('stays relative from today through years and warns from 7 days', () => {
    expect(applied('2026-10-07T08:00:00.000Z', 'en')).toBe('Applied today');
    expect(applied('2026-10-06T10:00:00.000Z', 'en')).toBe('Applied yesterday');
    expect(applied('2026-10-01T10:00:00.000Z', 'en')).toBe(
      'Applied 6 days ago',
    );
    expect(applied('2026-09-16T10:00:00.000Z', 'en')).toBe(
      'Applied 3 weeks ago',
    );
    expect(applied('2026-08-07T10:00:00.000Z', 'en')).toBe(
      'Applied 2 months ago',
    );
    expect(applied('2025-10-02T10:00:00.000Z', 'en')).toBe(
      'Applied 1 year ago',
    );

    expect(applied('2026-10-07T08:00:00.000Z', 'de')).toBe('Heute beworben');
    expect(applied('2026-10-06T10:00:00.000Z', 'de')).toBe('Gestern beworben');
    expect(applied('2026-10-01T10:00:00.000Z', 'de')).toBe(
      'Vor 6 Tagen beworben',
    );
    expect(applied('2026-09-16T10:00:00.000Z', 'de')).toBe(
      'Vor 3 Wochen beworben',
    );
    expect(applied('2026-08-07T10:00:00.000Z', 'de')).toBe(
      'Vor 2 Monaten beworben',
    );
    expect(applied('2025-10-02T10:00:00.000Z', 'de')).toBe(
      'Vor 1 Jahr beworben',
    );

    expect(
      formatAppliedWhen('2026-10-01T10:00:00.000Z', {
        locale: 'en',
        timeZone: TZ,
        now: NOW,
      })?.tone,
    ).toBe('neutral');
    expect(
      formatAppliedWhen('2026-09-30T10:00:00.000Z', {
        locale: 'en',
        timeZone: TZ,
        now: NOW,
      })?.tone,
    ).toBe('warning');
    expect(
      formatAppliedWhen('2026-09-29T10:00:00.000Z', {
        locale: 'en',
        timeZone: TZ,
        now: NOW,
      })?.tone,
    ).toBe('warning');
  });

  it('counts the Berlin day across midnight', () => {
    const afterMidnight = formatAppliedWhen('2026-10-07T20:00:00.000Z', {
      locale: 'en',
      timeZone: TZ,
      now: new Date('2026-10-07T22:30:00.000Z'),
    });
    expect(afterMidnight?.relative).toBe('yesterday');

    const nextBerlinDay = formatAppliedWhen('2026-10-07T22:30:00.000Z', {
      locale: 'en',
      timeZone: TZ,
      now: new Date('2026-10-07T21:30:00.000Z'),
    });
    expect(nextBerlinDay?.relative).toBe('today');
    expect(nextBerlinDay?.days).toBe(0);
  });
});

describe('idsSharingTitleAndDay', () => {
  it('marks every card that shares a title on the same day', () => {
    const shared = idsSharingTitleAndDay(
      [
        {
          id: 'a',
          title: 'Desk',
          startsAt: '2026-10-13T08:00:00.000Z',
        },
        {
          id: 'b',
          title: 'Desk',
          startsAt: '2026-10-13T12:00:00.000Z',
        },
        {
          id: 'c',
          title: 'Desk',
          startsAt: '2026-10-14T08:00:00.000Z',
        },
        {
          id: 'd',
          title: 'Reading',
          startsAt: '2026-10-13T08:00:00.000Z',
        },
      ],
      TZ,
    );

    expect([...shared].sort()).toEqual(['a', 'b']);
  });

  it('treats midnight in the org timezone as the next day', () => {
    const shared = idsSharingTitleAndDay(
      [
        {
          id: 'late',
          title: 'Desk',
          startsAt: '2026-10-07T21:30:00.000Z',
        },
        {
          id: 'after',
          title: 'Desk',
          startsAt: '2026-10-07T22:30:00.000Z',
        },
      ],
      TZ,
    );

    expect(shared.size).toBe(0);
  });
});

describe('formatDaysAway', () => {
  function away(startsAt: string, locale: string) {
    return formatDaysAway(startsAt, { locale, timeZone: TZ, now: NOW });
  }

  it('names today and tomorrow and stays neutral through 14 days', () => {
    expect(away('2026-10-07T18:00:00.000Z', 'en')).toEqual({
      label: 'Today',
      tone: 'danger',
    });
    expect(away('2026-10-08T08:00:00.000Z', 'en')).toEqual({
      label: 'Tomorrow',
      tone: 'warning',
    });
    expect(away('2026-10-13T08:00:00.000Z', 'en')).toEqual({
      label: 'In 6 days',
      tone: 'neutral',
    });
    expect(away('2026-10-21T08:00:00.000Z', 'en')).toEqual({
      label: 'In 14 days',
      tone: 'neutral',
    });
    expect(away('2026-10-22T08:00:00.000Z', 'en')).toBeUndefined();
  });

  it('shows a neutral Started chip when a past start reaches the UI', () => {
    const warnings: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      expect(away('2026-10-07T11:59:00.000Z', 'en')).toEqual({
        label: 'Started',
        tone: 'neutral',
      });
      expect(away('2026-10-07T11:59:00.000Z', 'de')?.label).toBe('Begonnen');
      expect(warnings.length).toBeGreaterThan(0);
    } finally {
      console.warn = original;
    }
  });

  it('uses the German names', () => {
    expect(away('2026-10-07T18:00:00.000Z', 'de')?.label).toBe('Heute');
    expect(away('2026-10-08T08:00:00.000Z', 'de')?.label).toBe('Morgen');
    expect(away('2026-10-09T08:00:00.000Z', 'de')?.label).toBe('In 2 Tagen');
    expect(away('2026-10-13T08:00:00.000Z', 'de')?.label).toBe('In 6 Tagen');
  });
});

describe('formatStatusAge', () => {
  function age(at: string, locale: string, warningAfterDays: number) {
    return formatStatusAge(at, {
      locale,
      timeZone: TZ,
      now: NOW,
      warningAfterDays,
    });
  }

  it('keeps a relative phrase and warns from each section threshold', () => {
    const declined = STATUS_WARNING_AFTER_DAYS.declinedDocuments.warning;
    const countersign = STATUS_WARNING_AFTER_DAYS.countersignDocuments.warning;

    expect(age('2026-10-04T10:00:00.000Z', 'en', declined)).toEqual({
      relative: '3 days ago',
      days: 3,
      tone: 'neutral',
    });
    expect(age('2026-10-07T08:00:00.000Z', 'en', declined)).toMatchObject({
      relative: 'today',
      days: 0,
      tone: 'neutral',
    });
    expect(age('2026-09-24T10:00:00.000Z', 'en', declined)?.tone).toBe(
      'neutral',
    );
    expect(age('2026-09-23T10:00:00.000Z', 'en', declined)?.tone).toBe(
      'warning',
    );
    expect(age('2026-09-22T10:00:00.000Z', 'en', declined)?.tone).toBe(
      'warning',
    );
    expect(age('2026-09-24T10:00:00.000Z', 'en', countersign)?.tone).toBe(
      'neutral',
    );
    expect(age('2026-09-23T10:00:00.000Z', 'en', countersign)?.tone).toBe(
      'warning',
    );
    expect(age('2026-09-22T10:00:00.000Z', 'en', countersign)?.tone).toBe(
      'warning',
    );
  });

  it('uses the German relative phrase', () => {
    expect(
      age(
        '2026-10-04T10:00:00.000Z',
        'de',
        STATUS_WARNING_AFTER_DAYS.declinedDocuments.warning,
      )?.relative,
    ).toBe('vor 3 Tagen');
  });

  it('counts the org-timezone day, not the UTC day', () => {
    expect(
      age(
        '2026-10-06T22:30:00.000Z',
        'en',
        STATUS_WARNING_AFTER_DAYS.declinedDocuments.warning,
      ),
    ).toMatchObject({
      relative: 'today',
      days: 0,
    });
  });
});
