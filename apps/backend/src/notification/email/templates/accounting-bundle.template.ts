import type { EmailTemplateContext } from '../../../i18n/email-translate';
import {
  card,
  type DetailTableRow,
  detailTable,
  escapeHtml,
  heading,
  paragraph,
  renderInternalEmail,
} from './shared';

export interface AccountingBundleTemplateData {
  /** Already rendered from the unit's subject setting. */
  subject: string;
  volunteerName: string;
  periodLabel: string;
  reimbursementTypeLabel: string;
  organizationUnitName: string;
  senderName: string;
  documentCount: number;
  confirmedIssues: string[];
}

export async function accountingBundleTemplate(
  data: AccountingBundleTemplateData,
  context: EmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const { t, formatList } = context;

  const rows: DetailTableRow[] = [
    {
      kind: 'pair',
      label: t('accountingBundle.detailVolunteer'),
      value: escapeHtml(data.volunteerName),
    },
    {
      kind: 'pair',
      label: t('accountingBundle.detailPeriod'),
      value: escapeHtml(data.periodLabel),
    },
    {
      kind: 'pair',
      label: t('accountingBundle.detailType'),
      value: escapeHtml(data.reimbursementTypeLabel),
    },
    {
      kind: 'pair',
      label: t('accountingBundle.detailUnit'),
      value: escapeHtml(data.organizationUnitName),
    },
    {
      kind: 'pair',
      label: t('accountingBundle.detailSentBy'),
      value: escapeHtml(data.senderName),
    },
  ];
  if (data.confirmedIssues.length > 0) {
    rows.push({
      kind: 'block',
      label: t('accountingBundle.detailConfirmedIssues'),
      value: escapeHtml(formatList(data.confirmedIssues)),
    });
  }

  const body = card(`
    ${heading(t('accountingBundle.heading'))}
    ${paragraph(
      t('accountingBundle.intro', {
        count: data.documentCount,
        volunteerName: escapeHtml(data.volunteerName),
      }),
      { padding: '0 0 16px' },
    )}
    ${detailTable(rows)}
  `);

  return renderInternalEmail({
    templateName: 'accountingBundleTemplate',
    subject: data.subject,
    previewText: t('accountingBundle.previewText', {
      volunteerName: escapeHtml(data.volunteerName),
      periodLabel: escapeHtml(data.periodLabel),
    }),
    body,
  });
}
