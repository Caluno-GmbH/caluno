import { describe, expect, it, mock } from 'bun:test';
import type { InvoiceService } from '../services';
import { InvoiceCoverLoader } from './invoice-cover.loader';

describe('InvoiceCoverLoader', () => {
  it('answers the invoices loaded in the same tick with one lookup and reads unknown ids as covered', async () => {
    const findInvoiceIdsWithoutActiveCover = mock(
      async (_ids: readonly string[]) => new Set(['a']),
    );
    const loader = new InvoiceCoverLoader({
      findInvoiceIdsWithoutActiveCover,
    } as unknown as InvoiceService);

    const answers = await Promise.all([
      loader.lacksActiveContractById.load('a'),
      loader.lacksActiveContractById.load('b'),
      loader.lacksActiveContractById.load('a'),
    ]);

    expect(answers).toEqual([true, false, true]);
    expect(findInvoiceIdsWithoutActiveCover).toHaveBeenCalledTimes(1);
    expect(findInvoiceIdsWithoutActiveCover.mock.calls[0]?.[0]).toEqual([
      'a',
      'b',
    ]);
  });
});
