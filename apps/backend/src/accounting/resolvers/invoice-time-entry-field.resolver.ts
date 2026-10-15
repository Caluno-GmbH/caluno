import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader } from '../../graphql/decorators/loader.decorator';
import { TimeEntry } from '../../time-tracking/models/time-entry.model';
import { InvoiceTimeEntry } from '../models/invoice-time-entry.model';
import type { InvoiceTimeEntryEntity } from '../schemas/invoice-time-entry.schema';
import { AccountingReferenceLoader } from './accounting-reference.loader';

@Resolver(() => InvoiceTimeEntry)
export class InvoiceTimeEntryFieldResolver {
  /**
   * Resolves via the claim's `timeEntryId` only. Safe because this field is
   * only reachable after `invoice` authorized the parent document — including
   * volunteer "My documents" requests that send no org-unit header.
   */
  @ResolveField(() => TimeEntry)
  async timeEntry(
    @Parent() invoiceTimeEntry: InvoiceTimeEntryEntity,
    @Loader(AccountingReferenceLoader) loader: AccountingReferenceLoader,
  ): Promise<TimeEntry> {
    return loader.timeEntryById.load(invoiceTimeEntry.timeEntryId);
  }
}
