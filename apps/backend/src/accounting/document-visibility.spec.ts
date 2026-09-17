import { describe, expect, it } from 'bun:test';
import { isIssuedDocument } from './document-visibility';
import { ContractStatus, DocumentKind, InvoiceStatus } from './enums';

describe('isIssuedDocument', () => {
  it('treats every contract status except DRAFT as issued', () => {
    expect(isIssuedDocument(DocumentKind.CONTRACT, ContractStatus.DRAFT)).toBe(
      false,
    );
    for (const status of [
      ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
      ContractStatus.AWAITING_NGO_SIGNATURE,
      ContractStatus.ACTIVE,
      ContractStatus.EXPIRED,
      ContractStatus.DECLINED,
    ]) {
      expect(isIssuedDocument(DocumentKind.CONTRACT, status)).toBe(true);
    }
  });

  it('treats every invoice status except DRAFT as issued', () => {
    expect(isIssuedDocument(DocumentKind.INVOICE, InvoiceStatus.DRAFT)).toBe(
      false,
    );
    for (const status of [
      InvoiceStatus.AWAITING_VOLUNTEER_SIGNATURE,
      InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE,
      InvoiceStatus.READY,
      InvoiceStatus.DECLINED,
    ]) {
      expect(isIssuedDocument(DocumentKind.INVOICE, status)).toBe(true);
    }
  });
});
