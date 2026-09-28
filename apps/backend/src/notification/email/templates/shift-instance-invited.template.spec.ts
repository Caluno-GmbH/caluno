import { describe, expect, it } from 'bun:test';
import { createEmailTemplateFixture } from '../../../../test/helpers/email-template-fixture';
import { ReimbursementTypeKey } from '../../../accounting/enums';
import { shiftInstanceInvitedTemplate } from './shift-instance-invited.template';

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
      createEmailTemplateFixture(),
    );

    expect(html).toContain('Compensated via volunteer allowance');
    expect(html).toContain('an agreement to sign');
  });

  it('shows nothing about compensation when the shift is unpaid', async () => {
    const { html } = await shiftInstanceInvitedTemplate(
      baseData,
      createEmailTemplateFixture(),
    );

    expect(html).not.toContain('Compensated via');
    expect(html).not.toContain('an agreement to sign');
  });
});
