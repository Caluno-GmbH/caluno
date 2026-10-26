import { buildBaseOptions } from '@repo/observability';
import * as Sentry from '@sentry/nestjs';
import {
  reportFixtureFailure,
  runFixtureSeed,
} from './fixture-failure-reporter';

jest.mock('@sentry/nestjs', () => ({
  init: jest.fn(),
  captureException: jest.fn(() => 'event-id'),
  flush: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@repo/observability', () => ({
  buildBaseOptions: jest.fn(() => ({ enabled: true })),
}));

const init = Sentry.init as jest.Mock;
const captureException = Sentry.captureException as jest.Mock;
const flush = Sentry.flush as jest.Mock;
const buildOptions = buildBaseOptions as jest.Mock;

const DSN = 'https://public@example.com/1';
const MANAGED_ENV = [
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'SENTRY_RELEASE',
  'SENTRY_TRACES_SAMPLE_RATE',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  jest.clearAllMocks();
  saved = {};
  for (const key of MANAGED_ENV) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const key of MANAGED_ENV) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
  jest.restoreAllMocks();
});

describe('reportFixtureFailure', () => {
  it('stays inert without a DSN', async () => {
    await reportFixtureFailure('demo', new Error('boom'));

    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it('initialises from the shared options and flushes before exit', async () => {
    process.env.SENTRY_DSN = DSN;
    process.env.SENTRY_ENVIRONMENT = 'production';
    process.env.SENTRY_RELEASE = 'sha';
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.1';
    const error = new Error('missing unit');

    await reportFixtureFailure('demo', error);

    expect(buildOptions).toHaveBeenCalledWith({
      dsn: DSN,
      environment: 'production',
      release: 'sha',
      tracesSampleRateOverride: '0.1',
    });
    expect(init).toHaveBeenCalledWith({
      enabled: true,
      ignoreErrors: [],
    });
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { fixture: 'demo', stage: 'database-seed' },
    });
    expect(flush).toHaveBeenCalledWith(2_000);
  });

  it('reports a timed-out flush instead of claiming delivery', async () => {
    process.env.SENTRY_DSN = DSN;
    flush.mockResolvedValueOnce(false);

    await reportFixtureFailure('demo', new Error('boom'));

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('not delivered before the flush timeout'),
    );
  });

  it('does not mask the fixture error when reporting fails', async () => {
    process.env.SENTRY_DSN = DSN;
    init.mockImplementationOnce(() => {
      throw new Error('sentry unavailable');
    });

    await expect(
      reportFixtureFailure('e2e', new Error('boom')),
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalled();
  });
});

describe('runFixtureSeed', () => {
  it('runs the seed without reporting when it succeeds', async () => {
    const exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const seed = jest.fn(async () => {});

    await runFixtureSeed('demo', seed);

    expect(seed).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('reports the failure and exits 1 when the seed fails', async () => {
    process.env.SENTRY_DSN = DSN;
    const exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const error = new Error('missing unit');

    await runFixtureSeed('demo', async () => {
      throw error;
    });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { fixture: 'demo', stage: 'database-seed' },
    });
    expect(exit).toHaveBeenCalledWith(1);
  });
});
