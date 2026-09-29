import { describe, expect, it } from 'bun:test';
import { createEmailTemplateFixture } from '../../../../test/helpers/email-template-fixture';
import { ReimbursementTypeKey } from '../../../accounting/enums';
import type { ShiftInviteSchedule } from '../../shift-invite-schedule';
import { shiftInvitedTemplate } from './shift-invited.template';

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
      createEmailTemplateFixture(),
    );

    expect(html).toContain('Compensated via trainer');
    expect(html).toContain('Übungsleiterpauschale');
    expect(html).toContain('an agreement to sign');
  });

  it('shows nothing about compensation when the shift is unpaid', async () => {
    const { html } = await shiftInvitedTemplate(
      baseData,
      createEmailTemplateFixture(),
    );

    expect(html).not.toContain('Compensated via');
    expect(html).not.toContain('an agreement to sign');
  });
});
