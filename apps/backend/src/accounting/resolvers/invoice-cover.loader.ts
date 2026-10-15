import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { RegisterLoader } from '../../graphql/interceptors';
import { InvoiceService } from '../services';

@RegisterLoader()
@Injectable({ scope: Scope.REQUEST })
export class InvoiceCoverLoader {
  constructor(private readonly invoiceService: InvoiceService) {}

  /** Whether the invoice has a claimed hour with no ACTIVE contract right now; one lookup per request. */
  public readonly lacksActiveContractById = new DataLoader<string, boolean>(
    async (invoiceIds) => {
      const flagged =
        await this.invoiceService.findInvoiceIdsWithoutActiveCover(invoiceIds);
      return invoiceIds.map((id) => flagged.has(id));
    },
  );
}
