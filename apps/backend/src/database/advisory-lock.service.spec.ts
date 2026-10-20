import { describe, expect, it, mock } from 'bun:test';
import { AdvisoryLockService } from './advisory-lock.service';
import type { DatabasePoolService } from './database-pool.service';

function makeService(options: { locked: boolean; unlockFails?: boolean }) {
  const query = mock(async (sql: string) => {
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ locked: options.locked }] };
    }
    if (options.unlockFails) {
      throw new Error('unlock failed');
    }
    return { rows: [] };
  });
  const release = mock((_destroy?: boolean) => {});
  const client = { query, release };
  const pool = { connect: mock(async () => client) };
  const service = new AdvisoryLockService({
    pool,
  } as unknown as DatabasePoolService);

  return { service, query, release };
}

describe('AdvisoryLockService', () => {
  it('runs the work and releases the lock when it is acquired', async () => {
    const { service, query, release } = makeService({ locked: true });
    const run = mock(async () => 'done');

    const result = await service.tryWithLock(42, run);

    expect(result).toBe('done');
    expect(run).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]).toEqual([
      'select pg_try_advisory_lock($1) as locked',
      [42],
    ]);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes('pg_advisory_unlock'),
      ),
    ).toBe(true);
    expect(release).toHaveBeenCalledWith();
  });

  it('skips the work when another instance holds the lock', async () => {
    const { service, query, release } = makeService({ locked: false });
    const run = mock(async () => 'done');

    const result = await service.tryWithLock(42, run);

    expect(result).toBeNull();
    expect(run).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes('pg_advisory_unlock'),
      ),
    ).toBe(false);
    expect(release).toHaveBeenCalledWith();
  });

  it('releases the lock and rethrows when the work fails', async () => {
    const { service, query, release } = makeService({ locked: true });
    const boom = new Error('boom');

    await expect(
      service.tryWithLock(42, () => Promise.reject(boom)),
    ).rejects.toBe(boom);

    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes('pg_advisory_unlock'),
      ),
    ).toBe(true);
    expect(release).toHaveBeenCalledWith();
  });

  it('destroys the connection when unlocking fails', async () => {
    const { service, release } = makeService({
      locked: true,
      unlockFails: true,
    });

    const result = await service.tryWithLock(42, async () => 'done');

    expect(result).toBe('done');
    expect(release).toHaveBeenCalledWith(true);
  });
});
