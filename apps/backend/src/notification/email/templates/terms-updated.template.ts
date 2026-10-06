import type { EmailTemplateContext } from '../../../i18n/email-translate';
import { TermsChangeClass } from '../../../terms/enums';
import {
  button,
  card,
  emailTheme,
  escapeHtml,
  heading,
  paragraph,
  renderEmail,
  unsubscribeFooterNote,
} from './shared';

export interface TermsUpdatedTemplateData {
  recipientFirstName: string;
  class: TermsChangeClass;
  acceptTermsUrl: string;
}

export async function termsUpdatedTemplate(
  data: TermsUpdatedTemplateData,
  context: EmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const { t } = context;
  const isMajor = data.class === TermsChangeClass.MAJOR;
  const body = card(`
    ${heading(t('termsUpdated.heading'))}
    ${paragraph(
      t('termsUpdated.greeting', {
        firstName: escapeHtml(data.recipientFirstName),
        brandName: emailTheme.brandName,
      }),
      { padding: '0 0 16px' },
    )}
    ${paragraph(
      isMajor
        ? t('termsUpdated.majorBody', { brandName: emailTheme.brandName })
        : t('termsUpdated.minorBody', { brandName: emailTheme.brandName }),
      { padding: '0 0 16px' },
    )}
    ${
      isMajor
        ? button({
            href: data.acceptTermsUrl,
            label: t('termsUpdated.buttonLabel'),
          })
        : ''
    }
  `);

  return renderEmail({
    templateName: 'termsUpdatedTemplate',
    subject: t('termsUpdated.subject'),
    previewText: isMajor
      ? t('termsUpdated.previewText', {
          action: t('termsUpdated.buttonLabel'),
        })
      : t('termsUpdated.previewTextMinor'),
    body,
    footerNote: [
      t('termsUpdated.footerNote', { brandName: emailTheme.brandName }),
      unsubscribeFooterNote(t),
    ]
      .filter(Boolean)
      .join('<br />'),
  });
}
