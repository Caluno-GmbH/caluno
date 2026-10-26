import { describe, expect, it } from 'bun:test';
import { createEmailTemplateFixture } from '../../../../test/helpers/email-template-fixture';
import { timeEntryAutoClosedTemplate } from './time-entry-auto-closed.template';

const baseData = {
  recipientFirstName: 'Sam',
  organizationUnitName: 'Acme Volunteers',
  shiftTitle: 'Food Distribution' as string | null,
  // 08:15Z / 12:30Z are 10:15 / 14:30 in Europe/Berlin (CEST).
  startedAt: new Date('2026-09-10T08:15:00.000Z'),
  endedAt: new Date('2026-09-10T12:30:00.000Z'),
};

describe('timeEntryAutoClosedTemplate', () => {
  it('renders shift title, check-in and recorded end', async () => {
    const { subject, html } = await timeEntryAutoClosedTemplate(
      baseData,
      createEmailTemplateFixture(),
    );

    expect(subject).toBe('You were checked out automatically');
    expect(html).toContain('Food Distribution');
    expect(html).toContain('Acme Volunteers');
    // ICU data differs per platform: en-DE renders `10.09.2026` on macOS but
    // `10/09/2026` on the Linux CI runner.
    expect(html).toMatch(/10[./]09[./]2026, 10:15/);
    expect(html).toMatch(/10[./]09[./]2026, 14:30/);
    expect(html).toContain(
      'If these times are wrong, please contact your coordinator.',
    );
  });

  it('omits shift row when shiftTitle is null', async () => {
    const { html } = await timeEntryAutoClosedTemplate(
      { ...baseData, shiftTitle: null },
      createEmailTemplateFixture(),
    );

    expect(html).not.toContain('Food Distribution');
    expect(html).not.toContain('Assignment');
    expect(html).toContain('Acme Volunteers');
  });

  it('escapes user-controlled values', async () => {
    const { html } = await timeEntryAutoClosedTemplate(
      { ...baseData, shiftTitle: '<script>alert(1)</script>' },
      createEmailTemplateFixture(),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders German subject for de locale', async () => {
    const { subject, html } = await timeEntryAutoClosedTemplate(
      baseData,
      createEmailTemplateFixture('de'),
    );

    expect(subject).toBe('Du wurdest automatisch ausgecheckt');
    expect(html).toContain(
      'Falls diese Zeiten nicht stimmen, wende dich bitte an deine Koordination.',
    );
  });
});
