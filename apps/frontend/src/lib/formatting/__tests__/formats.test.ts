import { describe, expect, it } from 'bun:test';
import { formats } from '../formats';

describe('formats', () => {
  // All inputs are UTC instants (the "Z" suffix). Because `format` always renders
  // in Europe/Berlin, the expected wall-clock values are Berlin local time:
  //   - summer (CEST) = UTC+2
  //   - winter (CET)  = UTC+1

  describe('formatDate with locale', () => {
    it('formats English dates with enGB (slash separators)', () => {
      // 2026-06-15T10:00Z -> 2026-06-15T12:00+02:00 (same day)
      expect(formats('en').formatDate(new Date('2026-06-15T10:00:00Z'))).toBe(
        '15/06/2026',
      );
    });

    it('formats German dates with dots as separators', () => {
      expect(formats('de').formatDate(new Date('2026-06-15T10:00:00Z'))).toBe(
        '15.06.2026',
      );
    });

    it('is case-insensitive when matching the locale', () => {
      expect(formats('EN').formatDate(new Date('2026-06-15T10:00:00Z'))).toBe(
        '15/06/2026',
      );
      expect(formats('DE').formatDate(new Date('2026-06-15T10:00:00Z'))).toBe(
        '15.06.2026',
      );
    });

    it('falls back to German formatting for an unsupported locale', () => {
      expect(formats('fr').formatDate(new Date('2026-06-15T10:00:00Z'))).toBe(
        '15.06.2026',
      );
    });

    // The options path goes through Intl rather than date-fns. A bare "en"
    // resolves to en-US there, which is month-first, so the two paths used to
    // disagree: "12/9" with options against "09/12/2026" without.
    it('keeps the options path day-first in English, matching the plain path', () => {
      const december9 = new Date('2026-12-09T10:00:00Z');

      expect(
        formats('en').formatDate(december9, {
          day: 'numeric',
          month: 'numeric',
        }),
      ).toBe('09/12');
      expect(formats('en').formatDate(december9)).toBe('09/12/2026');
    });

    it('keeps the options path day-first in German', () => {
      expect(
        formats('de').formatDate(new Date('2026-12-09T10:00:00Z'), {
          day: 'numeric',
          month: 'numeric',
        }),
      ).toBe('9.12.');
    });

    it('falls back to German for an unsupported locale on the options path', () => {
      expect(
        formats('fr').formatDate(new Date('2026-12-09T10:00:00Z'), {
          day: 'numeric',
          month: 'numeric',
        }),
      ).toBe('9.12.');
    });
  });

  describe('Adheres to Europe/Berlin Timezone', () => {
    it('applies daylight saving (CEST, UTC+2) for a summer date', () => {
      expect(formats('en').formatTime(new Date('2026-06-15T10:00:00Z'))).toBe(
        '12:00',
      );
    });

    it('applies standard time (CET, UTC+1) for a winter date', () => {
      expect(formats('en').formatTime(new Date('2026-01-15T10:00:00Z'))).toBe(
        '11:00',
      );
    });

    it('rolls the calendar day forward when a UTC time crosses midnight in Berlin', () => {
      expect(formats('en').formatDate(new Date('2026-06-15T22:00:00Z'))).toBe(
        '16/06/2026',
      );
    });
  });

  describe('formatDuration', () => {
    const from = new Date('2026-06-15T10:00:00Z');

    it('formats hours and minutes in English', () => {
      expect(
        formats('en').formatDuration(from, new Date('2026-06-15T12:30:00Z')),
      ).toBe('2 hours 30 minutes');
    });

    it('formats hours and minutes in German', () => {
      expect(
        formats('de').formatDuration(from, new Date('2026-06-15T12:30:00Z')),
      ).toBe('2 Stunden 30 Minuten');
    });

    it('Works with ISO string inputs as well as Date objects', () => {
      expect(
        formats('en').formatDuration(
          '2026-06-15T10:00:00Z',
          '2026-06-15T12:00:00Z',
        ),
      ).toBe('2 hours');
    });

    it('falls back to German formatting for an unsupported locale', () => {
      expect(
        formats('fr').formatDuration(from, new Date('2026-06-15T12:30:00Z')),
      ).toBe('2 Stunden 30 Minuten');
    });
  });

  describe('formatDurationByMinutes', () => {
    it('formats minutes as hours and minutes', () => {
      expect(formats('en').formatDurationByMinutes(90)).toBe(
        '1 hour 30 minutes',
      );
    });

    it('localises unit labels', () => {
      expect(formats('de').formatDurationByMinutes(90)).toBe(
        '1 Stunde 30 Minuten',
      );
    });

    it('falls back to German formatting for an unsupported locale', () => {
      expect(formats('fr').formatDurationByMinutes(90)).toBe(
        '1 Stunde 30 Minuten',
      );
    });
  });
});
