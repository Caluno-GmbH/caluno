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
import { shiftInstanceInvitedTemplate } from './shift-instance-invited.template';

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

const baseData = {
  organizationUnitName: 'Acme Volunteers',
  shiftId: 'shift-1',
  shiftTitle: 'Food Distribution',
  recipientFirstName: 'Sam',
  startsAt: new Date('2026-09-10T08:00:00.000Z'),
  endsAt: new Date('2026-09-10T12:00:00.000Z'),
  instanceId: 'instance-1',
};

describe('shiftInstanceInvitedTemplate', () => {
  it('names the Pauschalentyp and the agreement when the shift is paid', async () => {
    const { html } = await shiftInstanceInvitedTemplate(
      { ...baseData, reimbursementTypeKey: ReimbursementTypeKey.EHRENAMT },
      createFixtureTranslator(),
    );

    expect(html).toContain('Compensated via volunteer allowance');
    expect(html).toContain('an agreement to sign');
  });

  it('shows nothing about compensation when the shift is unpaid', async () => {
    const { html } = await shiftInstanceInvitedTemplate(
      baseData,
      createFixtureTranslator(),
    );

    expect(html).not.toContain('Compensated via');
    expect(html).not.toContain('an agreement to sign');
  });
});
