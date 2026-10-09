import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppI18nService } from '../../i18n/app-i18n.service';
import { createEmailTemplateContext } from '../email/email-template-context';
import { termsUpdatedTemplate } from '../email/templates/terms-updated.template';
import { NotificationService } from '../notification.service';
import type { NotificationEventPayloadMap } from '../notification-event-map';
import { NotificationEvent } from '../notification-events';

@Injectable()
export class TermsListener {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly appI18n: AppI18nService,
  ) {}

  @OnEvent(NotificationEvent.TERMS_UPDATED)
  async handleTermsUpdated(
    payload: NotificationEventPayloadMap[typeof NotificationEvent.TERMS_UPDATED],
  ): Promise<void> {
    await this.notificationService.sendNotification(
      payload.recipientUserIds,
      { event: NotificationEvent.TERMS_UPDATED },
      async (recipient) =>
        termsUpdatedTemplate(
          {
            recipientFirstName: recipient.firstName,
            class: payload.class,
            acceptTermsUrl: payload.acceptTermsUrl,
          },
          createEmailTemplateContext(this.appI18n, recipient.locale),
        ),
    );
  }
}
