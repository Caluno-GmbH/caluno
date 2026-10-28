import { describe, expect, it } from 'bun:test';
import { DataError } from '../../errors/data-error';
import { nullIfNotFound } from './use-document-templates';

describe('nullIfNotFound', () => {
  it('returns the loaded value', async () => {
    expect(await nullIfNotFound(async () => 'template')).toBe('template');
  });

  it('maps a NotFound error to null so an unset slot is not an error', async () => {
    const result = await nullIfNotFound(async () => {
      throw new DataError('No contract template', { code: 'NOT_FOUND' });
    });

    expect(result).toBeNull();
  });

  it('rethrows any other DataError', async () => {
    const forbidden = new DataError('No access', { code: 'FORBIDDEN' });

    await expect(
      nullIfNotFound(async () => {
        throw forbidden;
      }),
    ).rejects.toBe(forbidden);
  });

  it('rethrows non data errors', async () => {
    const failure = new Error('network down');

    await expect(
      nullIfNotFound(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
