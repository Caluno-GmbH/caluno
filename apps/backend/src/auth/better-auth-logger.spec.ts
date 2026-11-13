import { Writable } from 'node:stream';
import { createPinoLogger } from '@repo/observability';
import { createBetterAuthPinoLogger } from './better-auth-logger';

function captureLines(): {
  stream: Writable;
  lines: () => Array<Record<string, unknown>>;
} {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return {
    stream,
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('createBetterAuthPinoLogger', () => {
  it('emits Better Auth warn text as pino msg with context BetterAuth', () => {
    const { stream, lines } = captureLines();
    const pino = createPinoLogger({
      service: 'caluno-backend',
      nodeEnv: 'production',
      stream,
    });
    const betterAuthLogger = createBetterAuthPinoLogger(pino);

    betterAuthLogger.log?.('warn', 'Invalid password');

    const [record] = lines();
    expect(record).toMatchObject({
      level: 'warn',
      context: 'BetterAuth',
      msg: 'Invalid password',
      service: 'caluno-backend',
    });
  });

  it('merges plain-object args into the log record', () => {
    const { stream, lines } = captureLines();
    const pino = createPinoLogger({
      service: 'caluno-backend',
      nodeEnv: 'production',
      stream,
    });
    const betterAuthLogger = createBetterAuthPinoLogger(pino);

    betterAuthLogger.log?.('warn', 'Invalid id token', { provider: 'google' });

    const [record] = lines();
    expect(record).toMatchObject({
      msg: 'Invalid id token',
      context: 'BetterAuth',
      provider: 'google',
    });
  });

  it('serializes Error args on err (Better Auth background-task style)', () => {
    const { stream, lines } = captureLines();
    const pino = createPinoLogger({
      service: 'caluno-backend',
      nodeEnv: 'production',
      stream,
    });
    const betterAuthLogger = createBetterAuthPinoLogger(pino);
    const failure = new Error('SMTP connection refused');

    betterAuthLogger.log?.('error', 'Failed to run background task:', failure);

    const [record] = lines();
    expect(record).toMatchObject({
      level: 'error',
      context: 'BetterAuth',
      msg: 'Failed to run background task:',
    });
    expect(record?.err).toMatchObject({
      type: 'Error',
      message: 'SMTP connection refused',
    });
    expect((record?.err as { stack?: string })?.stack).toContain(
      'SMTP connection refused',
    );
  });

  it('maps each level to the matching pino method', () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const sink = {
      debug: (...args: unknown[]) => calls.push({ method: 'debug', args }),
      info: (...args: unknown[]) => calls.push({ method: 'info', args }),
      warn: (...args: unknown[]) => calls.push({ method: 'warn', args }),
      error: (...args: unknown[]) => calls.push({ method: 'error', args }),
    };
    const betterAuthLogger = createBetterAuthPinoLogger(sink);

    betterAuthLogger.log?.('debug', 'd');
    betterAuthLogger.log?.('info', 'i');
    betterAuthLogger.log?.('warn', 'w');
    betterAuthLogger.log?.('error', 'e');

    expect(calls.map((c) => c.method)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
    ]);
    for (const call of calls) {
      expect(call.args[0]).toEqual({ context: 'BetterAuth' });
      expect(typeof call.args[1]).toBe('string');
    }
  });
});
