import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { CheckInQrService } from './email/check-in-qr.service';
import { EmailService } from './email/email.service';
import { EmailTransportService } from './email/email-transport.service';
import { EmailOutboxService } from './email/outbox/email-outbox.service';
import { EmailOutboxWorkerService } from './email/outbox/email-outbox.worker';
import { DocumentListener } from './listeners/document.listener';
import { EventListener } from './listeners/event.listener';
import { MembershipListener } from './listeners/membership.listener';
import { OrganizationListener } from './listeners/organization.listener';
import { ShiftListener } from './listeners/shift.listener';
import { TermsListener } from './listeners/terms.listener';
import { NotificationService } from './notification.service';
import { TypedNotificationEmitter } from './typed-notification-emitter.service';

@Module({
  imports: [ConfigModule, DatabaseModule, UserModule],
  providers: [
    TypedNotificationEmitter,
    NotificationService,
    EmailTransportService,
    EmailOutboxService,
    EmailOutboxWorkerService,
    EmailService,
    CheckInQrService,
    OrganizationListener,
    MembershipListener,
    ShiftListener,
    EventListener,
    DocumentListener,
    TermsListener,
  ],
  exports: [NotificationService, EmailService, EmailOutboxService],
})
export class NotificationModule {}
