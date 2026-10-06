import { describe, expect, it } from 'bun:test';
import { createEmailTemplateFixture } from '../../../../test/helpers/email-template-fixture';
import { TermsChangeClass } from '../../../terms/enums';
import { termsUpdatedTemplate } from './terms-updated.template';

const ACCEPT_TERMS_URL = 'https://app.caluno.org/accept-terms';

const baseData = {
  recipientFirstName: 'Sam',
  acceptTermsUrl: ACCEPT_TERMS_URL,
};

describe('termsUpdatedTemplate', () => {
  it('renders the accept button and URL for a major change', async () => {
    const { html } = await termsUpdatedTemplate(
      { ...baseData, class: TermsChangeClass.MAJOR },
      createEmailTemplateFixture(),
    );

    expect(html).toContain(ACCEPT_TERMS_URL);
    expect(html).toContain('Review the new terms');
  });

  it('omits the accept button and URL for a minor change', async () => {
    const { html } = await termsUpdatedTemplate(
      { ...baseData, class: TermsChangeClass.MINOR },
      createEmailTemplateFixture(),
    );

    expect(html).not.toContain(ACCEPT_TERMS_URL);
    expect(html).not.toContain('Review the new terms');
  });
});
