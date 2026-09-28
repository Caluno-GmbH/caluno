import { describe, expect, it } from 'bun:test';
import { createEmailTemplateFixture } from '../../../../test/helpers/email-template-fixture';
import { membershipApprovedTemplate } from './membership-approved.template';

describe('membershipApprovedTemplate', () => {
  const baseData = {
    organizationUnitId: 'unit-1',
    organizationName: 'Acme Volunteers',
    recipientFirstName: 'Sam',
  };

  it('omits welcome and contact sections when unset', async () => {
    const { html } = await membershipApprovedTemplate(
      baseData,
      createEmailTemplateFixture(),
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
      createEmailTemplateFixture(),
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
      createEmailTemplateFixture(),
    );

    expect(html).toContain('Alex Contact');
    expect(html).toContain('href="mailto:alex@example.org"');
    expect(html).not.toContain('Phone');
  });
});
