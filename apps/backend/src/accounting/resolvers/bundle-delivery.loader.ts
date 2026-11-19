import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { RegisterLoader } from '../../graphql/interceptors';
import {
  BundleDeliveryLogService,
  type LatestEmailDelivery,
} from '../services/bundle-delivery-log.service';

@RegisterLoader()
@Injectable({ scope: Scope.REQUEST })
export class BundleDeliveryLoader {
  constructor(
    private readonly bundleDeliveryLogService: BundleDeliveryLogService,
  ) {}

  public readonly latestEmailByInvoiceId = new DataLoader<
    string,
    LatestEmailDelivery | null
  >(async (invoiceIds) => {
    const latest =
      await this.bundleDeliveryLogService.findLatestEmailDeliveries(invoiceIds);
    return invoiceIds.map((id) => latest.get(id) ?? null);
  });
}
