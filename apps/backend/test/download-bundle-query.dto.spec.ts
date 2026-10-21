import { describe, expect, it } from 'bun:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DownloadBundleQueryDto,
  MAX_NAMED_INVOICES,
} from '../src/accounting/dto/download-bundle-query.dto';

const id = () => crypto.randomUUID();

const check = async (query: Record<string, unknown>) => {
  const dto = plainToInstance(DownloadBundleQueryDto, query);
  return { dto, errors: await validate(dto, { whitelist: true }) };
};

describe('DownloadBundleQueryDto', () => {
  it('reads a comma separated list of ids', async () => {
    const [a, b] = [id(), id()];
    const { dto, errors } = await check({
      volunteerId: id(),
      reimbursementTypeId: id(),
      invoiceIds: `${a},${b}`,
    });
    expect(errors).toHaveLength(0);
    expect(dto.invoiceIds).toEqual([a, b]);
  });

  it('allows the list to be left out or empty', async () => {
    for (const invoiceIds of [undefined, '']) {
      const { dto, errors } = await check({
        volunteerId: id(),
        reimbursementTypeId: id(),
        invoiceIds,
      });
      expect(errors).toHaveLength(0);
      expect(dto.invoiceIds).toBeUndefined();
    }
  });

  it('rejects an id that is not a uuid', async () => {
    const { errors } = await check({
      volunteerId: id(),
      reimbursementTypeId: id(),
      invoiceIds: `${id()},not-a-uuid`,
    });
    expect(errors.map((e) => e.property)).toEqual(['invoiceIds']);
  });

  it('rejects more ids than the cap', async () => {
    const many = Array.from({ length: MAX_NAMED_INVOICES + 1 }, id).join(',');
    const { errors } = await check({
      volunteerId: id(),
      reimbursementTypeId: id(),
      invoiceIds: many,
    });
    expect(errors.map((e) => e.property)).toEqual(['invoiceIds']);
  });

  it('accepts a volunteer id issued by better auth', async () => {
    const { errors } = await check({
      volunteerId: '3dbX9t0w3VkUbdO2BLzPA8fsBCAe3gAN',
      reimbursementTypeId: id(),
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty volunteer or a type that is not a uuid', async () => {
    const { errors } = await check({
      volunteerId: '',
      reimbursementTypeId: 'y',
    });
    expect(errors.map((e) => e.property).sort()).toEqual([
      'reimbursementTypeId',
      'volunteerId',
    ]);
  });
});
