import { ContractStatus, DocumentKind, InvoiceStatus } from './enums';

/**
 * A document is "issued" — and therefore allowed to reach a volunteer — once
 * it has left DRAFT. Draft rows are auto-queued by `ensureDraftContract` and
 * live only on the admin's Create contracts stage; a draft has no rendered
 * PDF and has not been sent, so it must never be shown to the volunteer.
 */
export function isIssuedDocument(
  kind: DocumentKind,
  status: ContractStatus | InvoiceStatus,
): boolean {
  switch (kind) {
    case DocumentKind.CONTRACT:
      return status !== ContractStatus.DRAFT;
    case DocumentKind.INVOICE:
      return status !== InvoiceStatus.DRAFT;
  }
}
