import type { EmailTemplateContext } from '../../../i18n/email-translate';
import {
  card,
  type DetailTableRow,
  detailTable,
  divider,
  emailTheme,
  escapeHtml,
  heading,
  note,
  paragraph,
  renderEmail,
} from './shared';

export interface TimeEntryAutoClosedTemplateData {
  recipientFirstName: string;
  organizationUnitName: string;
  /** `null` for an entry that was not tied to a shift. */
  shiftTitle: string | null;
  startedAt: Date;
  endedAt: Date;
}

function buildDetailRows(
  data: TimeEntryAutoClosedTemplateData,
  { t, formatDateTime }: EmailTemplateContext,
): DetailTableRow[] {
  const rows: DetailTableRow[] = [];

  if (data.shiftTitle) {
    rows.push({
      kind: 'pair',
      label: t('timeEntryAutoClosed.detailShift'),
      value: escapeHtml(data.shiftTitle),
    });
  }

  rows.push(
    {
      kind: 'pair',
      label: t('timeEntryAutoClosed.detailOrganization'),
      value: escapeHtml(data.organizationUnitName),
    },
    {
      kind: 'pair',
      label: t('timeEntryAutoClosed.detailCheckIn'),
      value: escapeHtml(formatDateTime(data.startedAt)),
    },
    {
      kind: 'pair',
      label: t('timeEntryAutoClosed.detailRecordedEnd'),
      value: escapeHtml(formatDateTime(data.endedAt)),
    },
  );

  return rows;
}

export async function timeEntryAutoClosedTemplate(
  data: TimeEntryAutoClosedTemplateData,
  context: EmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const { t } = context;
  const firstName = escapeHtml(data.recipientFirstName);
  const brandName = emailTheme.brandName;

  const body = card(`
    ${heading(t('timeEntryAutoClosed.heading'))}
    ${paragraph(t('timeEntryAutoClosed.intro', { firstName }), {
      padding: '0 0 16px',
    })}
    ${detailTable(buildDetailRows(data, context))}
    ${divider('0 0 16px')}
    ${note(t('timeEntryAutoClosed.contactCoordinator'))}
  `);

  return renderEmail({
    templateName: 'timeEntryAutoClosedTemplate',
    subject: t('timeEntryAutoClosed.subject'),
    previewText: t('timeEntryAutoClosed.previewText'),
    body,
    // Always sent, so no unsubscribe prompt — there is no setting behind it.
    footerNote: t('timeEntryAutoClosed.footerNote', { brandName }),
  });
}
