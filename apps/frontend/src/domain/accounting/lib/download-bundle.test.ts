import { describe, expect, it } from 'bun:test';
import { buildBundleDownloadUrl } from './download-bundle';

describe('buildBundleDownloadUrl', () => {
  it('targets the reimbursement-bundle download endpoint', () => {
    const url = buildBundleDownloadUrl({
      volunteerId: 'vol-1',
      reimbursementTypeId: 'rt-1',
      invoiceIds: ['inv-a', 'inv-b'],
    });
    expect(url).toContain('/accounting/reimbursement-bundle/download');
  });

  it('encodes volunteerId and reimbursementTypeId', () => {
    const url = buildBundleDownloadUrl({
      volunteerId: 'vol-special/chars',
      reimbursementTypeId: 'rt-special&chars',
      invoiceIds: ['inv-1'],
    });
    expect(url).toContain(
      `volunteerId=${encodeURIComponent('vol-special/chars')}`,
    );
    expect(url).toContain(
      `reimbursementTypeId=${encodeURIComponent('rt-special&chars')}`,
    );
  });

  it('joins invoiceIds with commas and encodes the result', () => {
    const url = buildBundleDownloadUrl({
      volunteerId: 'vol-1',
      reimbursementTypeId: 'rt-1',
      invoiceIds: ['inv-a', 'inv-b', 'inv-c'],
    });
    expect(url).toContain(
      `invoiceIds=${encodeURIComponent('inv-a,inv-b,inv-c')}`,
    );
  });

  it('handles a single invoiceId without a trailing comma', () => {
    const url = buildBundleDownloadUrl({
      volunteerId: 'vol-1',
      reimbursementTypeId: 'rt-1',
      invoiceIds: ['only-one'],
    });
    expect(url).toContain(`invoiceIds=${encodeURIComponent('only-one')}`);
    expect(url).not.toContain(',');
  });
});
