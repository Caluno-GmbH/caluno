/**
 * Queued-email lifecycle. SENT means the provider accepted the message, not
 * that the mailbox received it; FAILED and CANCELLED are terminal.
 */
export enum EmailDeliveryStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum EmailCategory {
  CALL_OUT = 'CALL_OUT',
  CALL_OUT_NO_RECIPIENTS = 'CALL_OUT_NO_RECIPIENTS',
  MANAGER_NOTIFICATION = 'MANAGER_NOTIFICATION',
  DIGEST = 'DIGEST',
  INVITE_REMINDER = 'INVITE_REMINDER',
  NOTIFICATION = 'NOTIFICATION',
  AUTH = 'AUTH',
  SUPPORT = 'SUPPORT',
}
