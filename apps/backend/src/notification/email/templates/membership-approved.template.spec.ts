import { describe, expect, it } from 'bun:test';
import type { EmailTemplateContext } from '../../../i18n/email-translate';
import {
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleList,
  formatLocaleTime,
} from '../../../i18n/format-date-time';
import enEmail from '../../../i18n/locales/en/email.json';
import { membershipApprovedTemplate } from './membership-approved.template';

function createFixtureTranslator(locale: 'en'): EmailTemplateContext {
  const catalog = locale === 'en' ? enEmail : enEmail;

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
    formatDateTime: (date) => formatLocaleDateTime(date, locale),
    formatDate: (date) => formatLocaleDate(date, locale),
    formatTime: (date) => formatLocaleTime(date, locale),
    formatList: (items) => formatLocaleList(items, locale),
  };
}

describe('membershipApprovedTemplate', () => {
  const baseData = {
    organizationUnitId: 'unit-1',
    organizationName: 'Acme Volunteers',
    recipientFirstName: 'Sam',
  };

  it('omits welcome and contact sections when unset', async () => {
    const { html } = await membershipApprovedTemplate(
      baseData,
      createFixtureTranslator('en'),
    );

    expect(html).not.toContain('A message from the team');
    expect(html).not.toContain('Your contact person');
  });

  it('renders welcome message and contact person with mailto link', async () => {
    const { html } = await membershipApprovedTemplate(
      {
        ...baseData,
        contact: {
          welcomeMessage: 'We are happy you joined us.',
          contactPersonName: 'Alex Contact',
          contactEmail: 'alex@example.org',
          phone: '+49 30 123456',
        },
      },
      createFixtureTranslator('en'),
    );

    expect(html).toContain('A message from the team');
    expect(html).toContain('We are happy you joined us.');
    expect(html).toContain('Your contact person');
    expect(html).toContain('Alex Contact');
    expect(html).toContain('href="mailto:alex@example.org"');
    expect(html).toContain('+49 30 123456');
  });

  it('omits empty contact fields within the contact section', async () => {
    const { html } = await membershipApprovedTemplate(
      {
        ...baseData,
        contact: {
          contactPersonName: 'Alex Contact',
          contactEmail: 'alex@example.org',
          phone: null,
        },
      },
      createFixtureTranslator('en'),
    );

    expect(html).toContain('Alex Contact');
    expect(html).toContain('href="mailto:alex@example.org"');
    expect(html).not.toContain('Phone');
  });
});
