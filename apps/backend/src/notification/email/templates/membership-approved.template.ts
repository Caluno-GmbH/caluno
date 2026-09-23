import type { EmailTemplateContext } from '../../../i18n/email-translate';
import type { MembershipApprovedContactPayload } from '../../payloads/membership-approved.payload';
import { CHECK_IN_QR_IMAGE_CID } from '../check-in-qr.service';
import {
  hasWelcomeEmailContactSection,
  type WelcomeEmailContact,
} from './membership-approved-contact';
import {
  button,
  card,
  divider,
  emailTheme,
  escapeHtml,
  heading,
  orderedListItem,
  paragraph,
  publicOrganizationUnitUrl,
  renderEmail,
  strong,
  unsubscribeFooterNote,
} from './shared';

export interface MembershipApprovedTemplateData {
  organizationUnitId: string;
  organizationName: string;
  recipientFirstName: string;
  contact?: MembershipApprovedContactPayload | null;
}

function mailtoLink(email: string): string {
  const safeEmail = escapeHtml(email);
  return `<a href="mailto:${safeEmail}" style="color:${emailTheme.colors.primary};text-decoration:none">${safeEmail}</a>`;
}

function renderWelcomeMessage(
  welcomeMessage: string,
  t: EmailTemplateContext['t'],
): string {
  return `
    ${divider()}
    ${heading(t('membershipApproved.welcomeMessageHeading'), { size: '18px', padding: '0 0 16px', letterSpacing: '-0.01em' })}
    ${paragraph(escapeHtml(welcomeMessage).replace(/\n/g, '<br />'))}
  `;
}

function renderContactPersonSection(
  contact: WelcomeEmailContact,
  t: EmailTemplateContext['t'],
): string {
  const detailLines: string[] = [];

  if (contact.contactPersonName) {
    detailLines.push(
      `${strong(t('membershipApproved.contactNameLabel'))}: ${escapeHtml(contact.contactPersonName)}`,
    );
  }

  if (contact.contactEmail) {
    detailLines.push(
      `${strong(t('membershipApproved.contactEmailLabel'))}: ${mailtoLink(contact.contactEmail)}`,
    );
  }

  if (contact.phone) {
    detailLines.push(
      `${strong(t('membershipApproved.contactPhoneLabel'))}: ${escapeHtml(contact.phone)}`,
    );
  }

  const details = detailLines
    .map((line, index) =>
      paragraph(line, {
        padding: index === detailLines.length - 1 ? '0 0 24px' : '0 0 8px',
      }),
    )
    .join('');

  return `
    ${divider()}
    ${heading(t('membershipApproved.contactHeading'), { size: '18px', padding: '0 0 16px', letterSpacing: '-0.01em' })}
    ${details}
  `;
}

export async function membershipApprovedTemplate(
  data: MembershipApprovedTemplateData,
  { t }: EmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const firstName = escapeHtml(data.recipientFirstName);
  const organizationName = escapeHtml(data.organizationName);
  const organizationUrl = publicOrganizationUnitUrl(data.organizationUnitId);
  const brandName = emailTheme.brandName;

  const contact: WelcomeEmailContact = {
    contactPersonName: data.contact?.contactPersonName ?? null,
    contactEmail: data.contact?.contactEmail ?? null,
    phone: data.contact?.phone ?? null,
    welcomeMessage: data.contact?.welcomeMessage ?? null,
  };

  const welcomeMessageSection = contact.welcomeMessage
    ? renderWelcomeMessage(contact.welcomeMessage, t)
    : '';

  const contactSection = hasWelcomeEmailContactSection(contact)
    ? renderContactPersonSection(contact, t)
    : '';

  const body = card(`
    ${heading(t('membershipApproved.heading'))}
    ${paragraph(
      `${t('membershipApproved.greetingBefore', { firstName })} ${strong(organizationName)} ${t('membershipApproved.greetingAfter')}`,
    )}
    ${welcomeMessageSection}
    ${contactSection}
    ${button({
      href: organizationUrl,
      label: t('membershipApproved.buttonLabel', {
        organizationName: data.organizationName,
      }),
    })}
    ${paragraph(t('membershipApproved.checkInQrNote'))}
    <mj-image
      src="cid:${CHECK_IN_QR_IMAGE_CID}"
      alt="${escapeHtml(t('membershipApproved.checkInQrAlt'))}"
      width="220px"
      padding="0 0 24px"
    />
    ${divider()}
    ${heading(t('membershipApproved.nextStepsHeading'), { size: '18px', padding: '0 0 16px', letterSpacing: '-0.01em' })}
    ${orderedListItem(1, `${strong(t('membershipApproved.step1Title'))}: ${t('membershipApproved.step1Detail')}`)}
    ${orderedListItem(2, `${strong(t('membershipApproved.step2Title'))}: ${t('membershipApproved.step2Detail')}`)}
    ${orderedListItem(3, `${strong(t('membershipApproved.step3Title'))}: ${t('membershipApproved.step3Detail')}`, { last: true })}
  `);

  return renderEmail({
    templateName: 'membershipApprovedTemplate',
    subject: t('membershipApproved.subject', {
      organizationName: data.organizationName,
    }),
    previewText: t('membershipApproved.previewText', {
      organizationName: data.organizationName,
    }),
    body,
    footerNote: [
      t('membershipApproved.footerNote', {
        organizationName: data.organizationName,
        brandName,
      }),
      unsubscribeFooterNote(t),
    ]
      .filter(Boolean)
      .join('<br />'),
  });
}
