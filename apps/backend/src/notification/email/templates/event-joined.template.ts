import type { EmailTemplateContext } from '../../../i18n/email-translate';
import {
  button,
  card,
  detailItem,
  divider,
  emailTheme,
  escapeHtml,
  eventAdminUrl,
  heading,
  note,
  paragraph,
  renderEmail,
} from './shared';

export interface EventJoinedTemplateData {
  organizationUnitId: string;
  organizationUnitName: string;
  eventId: string;
  eventTitle: string;
  volunteerName: string;
  recipientFirstName: string;
  startsAt: Date;
}

export async function eventJoinedTemplate(
  data: EventJoinedTemplateData,
  { t, formatDateTime }: EmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const firstName = escapeHtml(data.recipientFirstName);
  const organizationUnitName = escapeHtml(data.organizationUnitName);
  const eventTitle = escapeHtml(data.eventTitle);
  const volunteerName = escapeHtml(data.volunteerName);
  const startsAt = escapeHtml(formatDateTime(data.startsAt));
  const eventUrl = eventAdminUrl(data.organizationUnitId, data.eventId);
  const brandName = emailTheme.brandName;

  const body = card(`
    ${heading(t('eventJoined.heading'))}
    ${paragraph(t('eventJoined.greeting', { firstName }), {
      padding: '0 0 20px',
    })}
    ${detailItem(t('eventJoined.detailVolunteer'), volunteerName)}
    ${detailItem(t('eventJoined.detailEvent'), eventTitle)}
    ${detailItem(t('eventJoined.detailOrganization'), organizationUnitName)}
    ${detailItem(t('eventJoined.detailStarts'), startsAt, { last: true })}
    ${button({ href: eventUrl, label: t('eventJoined.buttonLabel') })}
    ${divider()}
    ${note(t('eventJoined.note'))}
  `);

  return renderEmail({
    templateName: 'eventJoinedTemplate',
    subject: t('eventJoined.subject', {
      eventTitle: data.eventTitle,
      volunteerName: data.volunteerName,
    }),
    previewText: t('eventJoined.previewText', {
      volunteerName: data.volunteerName,
      eventTitle: data.eventTitle,
      organizationName: data.organizationUnitName,
      startsAt,
    }),
    body,
    footerNote: t('eventJoined.footerNote', { brandName }),
  });
}
