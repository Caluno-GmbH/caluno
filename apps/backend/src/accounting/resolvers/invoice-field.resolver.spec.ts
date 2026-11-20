import { describe, expect, it, mock } from 'bun:test';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { EmailDeliveryStatus } from '../../notification/email/outbox/email-outbox.enums';
import { BundleDeliveryMethod } from '../enums';
import type { InvoiceEntity } from '../schemas/invoice.schema';
import type { BundleDeliveryLoader } from './bundle-delivery.loader';
import { InvoiceFieldResolver } from './invoice-field.resolver';

const invoice = (overrides: Partial<InvoiceEntity> = {}): InvoiceEntity =>
  ({
    id: 'invoice-1',
    volunteerId: 'volunteer-1',
    ...overrides,
  }) as InvoiceEntity;

const session = (userId: string): UserSession =>
  ({ user: { id: userId } }) as unknown as UserSession;

const deliveryLoader = (load: (id: string) => Promise<unknown>) =>
  ({ deliveriesByInvoiceId: { load } }) as unknown as BundleDeliveryLoader;

/** Every constructor collaborator is unused by the two delivery fields. */
const newResolver = () =>
  new InvoiceFieldResolver(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

const record = (
  id: string,
  overrides: Partial<{
    method: BundleDeliveryMethod;
    deliveredByUserId: string | null;
    status: EmailDeliveryStatus | null;
  }> = {},
) => ({
  id,
  method: overrides.method ?? BundleDeliveryMethod.DOWNLOAD,
  occurredAt: new Date('2026-08-01T09:00:00.000Z'),
  deliveredByUserId:
    overrides.deliveredByUserId === undefined
      ? 'admin-1'
      : overrides.deliveredByUserId,
  status: overrides.status ?? null,
});

describe('InvoiceFieldResolver.lastDelivery', () => {
  it('hides the accounting trail from the volunteer themself', async () => {
    const load = mock();
    const result = await newResolver().lastDelivery(
      invoice({ volunteerId: 'user-1' }),
      session('user-1'),
      deliveryLoader(load),
      {} as never,
    );

    expect(result).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('returns the newest delivery with its sender for accounting', async () => {
    const load = mock(async () => [
      record('delivery-2', {
        method: BundleDeliveryMethod.EMAIL,
        status: EmailDeliveryStatus.SENT,
      }),
      record('delivery-1'),
    ]);
    const userById = mock(async () => ({ id: 'admin-1', name: 'Julia' }));

    const result = await newResolver().lastDelivery(
      invoice(),
      session('admin-2'),
      deliveryLoader(load),
      { userById: { load: userById } } as never,
    );

    expect(result).toEqual({
      id: 'delivery-2',
      method: BundleDeliveryMethod.EMAIL,
      occurredAt: new Date('2026-08-01T09:00:00.000Z'),
      deliveredByUser: { id: 'admin-1', name: 'Julia' },
      status: EmailDeliveryStatus.SENT,
    });
    expect(load).toHaveBeenCalledWith('invoice-1');
    expect(userById).toHaveBeenCalledWith('admin-1');
  });

  it('returns null when the invoice was never delivered', async () => {
    const result = await newResolver().lastDelivery(
      invoice(),
      session('admin-2'),
      deliveryLoader(mock(async () => [])),
      {} as never,
    );

    expect(result).toBeNull();
  });
});

describe('InvoiceFieldResolver.deliveries', () => {
  it('returns an empty list for the volunteer themself', async () => {
    const load = mock();
    const result = await newResolver().deliveries(
      invoice({ volunteerId: 'user-1' }),
      session('user-1'),
      deliveryLoader(load),
      {} as never,
    );

    expect(result).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('maps every delivery and skips the sender lookup when there is none', async () => {
    const userById = mock(async () => ({ id: 'admin-1', name: 'Julia' }));
    const result = await newResolver().deliveries(
      invoice(),
      session('admin-2'),
      deliveryLoader(
        mock(async () => [
          record('delivery-1'),
          record('delivery-2', { deliveredByUserId: null }),
        ]),
      ),
      { userById: { load: userById } } as never,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.deliveredByUser?.name).toBe('Julia');
    expect(result[1]?.deliveredByUser).toBeNull();
    expect(userById).toHaveBeenCalledTimes(1);
  });
});
