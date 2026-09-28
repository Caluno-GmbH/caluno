import type { EmailTemplateContext } from '../../../i18n/email-translate';
import {
  button,
  card,
  detailItem,
  divider,
  emailTheme,
  escapeHtml,
  heading,
  note,
  paragraph,
  renderEmail,
  shiftInstanceAdminUrl,
} from './shared';

export interface ShiftInstanceJoinedTemplateData {
  organizationUnitId: string;
  organizationUnitName: string;
  shiftId: string;
  shiftTitle: string;
  instanceId: string;
  volunteerName: string;
  recipientFirstName: string;
  startsAt: Date;
}

export async function shiftInstanceJoinedTemplate(
  data: ShiftInstanceJoinedTemplateData,
  { t, formatDateTime }: EmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const firstName = escapeHtml(data.recipientFirstName);
  const organizationUnitName = escapeHtml(data.organizationUnitName);
  const shiftTitle = escapeHtml(data.shiftTitle);
  const volunteerName = escapeHtml(data.volunteerName);
  const startsAt = escapeHtml(formatDateTime(data.startsAt));
  const instanceUrl = shiftInstanceAdminUrl(
    data.organizationUnitId,
    data.shiftId,
    data.instanceId,
  );
  const brandName = emailTheme.brandName;

  const body = card(`
    ${heading(t('shiftInstanceJoined.heading'))}
    ${paragraph(t('shiftInstanceJoined.greeting', { firstName }), {
      padding: '0 0 20px',
    })}
    ${detailItem(t('shiftInstanceJoined.detailVolunteer'), volunteerName)}
    ${detailItem(t('shiftInstanceJoined.detailShift'), shiftTitle)}
    ${detailItem(t('shiftInstanceJoined.detailOrganization'), organizationUnitName)}
    ${detailItem(t('shiftInstanceJoined.detailStarts'), startsAt, { last: true })}
    ${button({ href: instanceUrl, label: t('shiftInstanceJoined.buttonLabel') })}
    ${divider()}
    ${note(t('shiftInstanceJoined.note'))}
  `);

  return renderEmail({
    templateName: 'shiftInstanceJoinedTemplate',
    subject: t('shiftInstanceJoined.subject', {
      shiftTitle: data.shiftTitle,
      volunteerName: data.volunteerName,
    }),
    previewText: t('shiftInstanceJoined.previewText', {
      volunteerName: data.volunteerName,
      shiftTitle: data.shiftTitle,
      organizationName: data.organizationUnitName,
      startsAt,
    }),
    body,
    footerNote: t('shiftInstanceJoined.footerNote', { brandName }),
  });
}
