import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { DataError } from '@repo/data';

const notFoundMock = mock(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const loggerError = mock(() => undefined);

mock.module('next/navigation', () => ({
  notFound: notFoundMock,
}));

mock.module('@/lib/logger', () => ({
  logger: { error: loggerError },
}));

const { requireFound, requireFoundOrNull } = await import('../require-found');

describe('requireFound', () => {
  beforeEach(() => {
    notFoundMock.mockClear();
    loggerError.mockClear();
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

describe('requireFoundOrNull', () => {
  beforeEach(() => {
    notFoundMock.mockClear();
    loggerError.mockClear();
  });

  it('returns the loaded value', async () => {
    const value = await requireFoundOrNull(async () => ({ id: '1' }));
    expect(value).toEqual({ id: '1' });
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('calls notFound when the loader returns null', async () => {
    await expect(requireFoundOrNull(async () => null)).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('calls notFound when the loader throws a NOT_FOUND DataError', async () => {
    await expect(
      requireFoundOrNull(async () => {
        throw new DataError('missing', { code: 'NOT_FOUND' });
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('logs and returns null for other errors', async () => {
    const error = new Error('boom');
    const value = await requireFoundOrNull(async () => {
      throw error;
    });
    expect(value).toBeNull();
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError.mock.calls[0]?.[0]).toEqual({ err: error });
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
