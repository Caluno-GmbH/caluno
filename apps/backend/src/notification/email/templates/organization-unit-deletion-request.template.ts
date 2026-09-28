import type { EmailTemplateContext } from '../../../i18n/email-translate';
import {
  button,
  card,
  type DetailTableRow,
  detailTable,
  escapeHtml,
  heading,
  organizationAdminUrl,
  paragraph,
  renderInternalEmail,
} from './shared';

export interface OrganizationUnitDeletionRequestTemplateData {
  organizationUnitId: string;
  organizationUnitName: string;
  organizationName: string;
  requesterName: string;
  requesterEmail: string;
  message: string | undefined;
  requestedAt: Date;
}

function buildDetailRows(
  data: OrganizationUnitDeletionRequestTemplateData,
  { t, formatDateTime }: EmailTemplateContext,
): DetailTableRow[] {
  const rows: DetailTableRow[] = [
    {
      kind: 'pair',
      label: t('organizationUnitDeletionRequest.detailOrganization'),
      value: escapeHtml(data.organizationName),
    },
    {
      kind: 'pair',
      label: t('organizationUnitDeletionRequest.detailUnit'),
      value: escapeHtml(data.organizationUnitName),
    },
    {
      kind: 'pair',
      label: t('organizationUnitDeletionRequest.detailRequestedBy'),
      value: `${escapeHtml(data.requesterName)} (<a href="mailto:${escapeHtml(data.requesterEmail)}">${escapeHtml(data.requesterEmail)}</a>)`,
    },
    {
      kind: 'pair',
      label: t('organizationUnitDeletionRequest.detailRequestedAt'),
      value: escapeHtml(formatDateTime(data.requestedAt)),
    },
  ];

  if (data.message) {
    rows.push({
      kind: 'block',
      label: t('organizationUnitDeletionRequest.detailMessage'),
      value: escapeHtml(data.message),
    });
  }

  return rows;
}

export async function organizationUnitDeletionRequestTemplate(
  data: OrganizationUnitDeletionRequestTemplateData,
  context: EmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const { t } = context;
  const unitUrl = organizationAdminUrl(data.organizationUnitId);

  const body = card(`
    ${heading(t('organizationUnitDeletionRequest.heading'))}
    ${paragraph(
      t('organizationUnitDeletionRequest.intro', {
        requesterName: escapeHtml(data.requesterName),
        organizationUnitName: escapeHtml(data.organizationUnitName),
      }),
      { padding: '0 0 16px' },
    )}
    ${detailTable(buildDetailRows(data, context))}
    ${button({ href: unitUrl, label: t('organizationUnitDeletionRequest.buttonLabel') })}
  `);

  return renderInternalEmail({
    templateName: 'organizationUnitDeletionRequestTemplate',
    subject: t('organizationUnitDeletionRequest.subject', {
      organizationUnitName: data.organizationUnitName,
    }),
    previewText: t('organizationUnitDeletionRequest.previewText', {
      requesterName: data.requesterName,
      organizationUnitName: data.organizationUnitName,
    }),
    body,
  });
}
