import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { DataError } from '@repo/data';

const notFoundMock = mock(() => {
  throw new Error('NEXT_NOT_FOUND');
});

mock.module('next/navigation', () => ({
  notFound: notFoundMock,
}));

const { requireFound } = await import('../require-found');

describe('requireFound', () => {
  beforeEach(() => {
    notFoundMock.mockClear();
  });

  it('returns the loaded value', async () => {
    const value = await requireFound(async () => ({ id: '1' }));
    expect(value).toEqual({ id: '1' });
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('calls notFound when the loader returns null', async () => {
    await expect(requireFound(async () => null)).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('calls notFound when the loader throws a NOT_FOUND DataError', async () => {
    await expect(
      requireFound(async () => {
        throw new DataError('missing', { code: 'NOT_FOUND' });
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows other errors by default', async () => {
    await expect(
      requireFound(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('uses onOtherError for non-not-found errors', async () => {
    const fallback = await requireFound(
      async () => {
        throw new Error('boom');
      },
      () => 'fallback',
    );
    expect(fallback).toBe('fallback');
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
