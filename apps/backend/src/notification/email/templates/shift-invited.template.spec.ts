import { describe, expect, it } from 'bun:test';
import { ReimbursementTypeKey } from '../../../accounting/enums';
import type { EmailTemplateContext } from '../../../i18n/email-translate';
import {
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleList,
  formatLocaleTime,
} from '../../../i18n/format-date-time';
import enEmail from '../../../i18n/locales/en/email.json';
import type { ShiftInviteSchedule } from '../../shift-invite-schedule';
import { shiftInvitedTemplate } from './shift-invited.template';

function createFixtureTranslator(): EmailTemplateContext {
  const catalog = enEmail;

  return {
    t: (key, params) => {
      const parts = key.split('.');
      let value: unknown = catalog;
      for (const part of parts) {
        value = (value as Record<string, unknown>)[part];
      }
      if (typeof value !== 'string') {
        throw new Error(`Missing email translation for ${key}`);
      }
      return Object.entries(params ?? {}).reduce(
        (result, [paramKey, paramValue]) =>
          result.replace(`{${paramKey}}`, String(paramValue)),
        value,
      );
    },
    formatDateTime: (date) => formatLocaleDateTime(date, 'en'),
    formatDate: (date) => formatLocaleDate(date, 'en'),
    formatTime: (date) => formatLocaleTime(date, 'en'),
    formatList: (items) => formatLocaleList(items, 'en'),
  };
}

const schedule: ShiftInviteSchedule = {
  isRecurring: false,
  occurrenceCount: 1,
  recurrenceDays: [],
  firstOccurrenceStartsAt: new Date('2026-09-10T08:00:00.000Z'),
  firstOccurrenceEndsAt: new Date('2026-09-10T12:00:00.000Z'),
};

const baseData = {
  organizationUnitName: 'Acme Volunteers',
  shiftId: 'shift-1',
  shiftTitle: 'Food Distribution',
  recipientFirstName: 'Sam',
  schedule,
};

describe('shiftInvitedTemplate', () => {
  it('names the Pauschalentyp and the agreement when the shift is paid', async () => {
    const { html } = await shiftInvitedTemplate(
      { ...baseData, reimbursementTypeKey: ReimbursementTypeKey.UEBUNGSLEITER },
      createFixtureTranslator(),
    );

    expect(html).toContain('Compensated via trainer');
    expect(html).toContain('Übungsleiterpauschale');
    expect(html).toContain('an agreement to sign');
  });

  it('shows nothing about compensation when the shift is unpaid', async () => {
    const { html } = await shiftInvitedTemplate(
      baseData,
      createFixtureTranslator(),
    );

    expect(html).not.toContain('Compensated via');
    expect(html).not.toContain('an agreement to sign');
  });
});
