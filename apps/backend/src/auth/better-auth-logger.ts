import type { BetterAuthLogger } from './auth';

/**
 * Minimal pino-shaped sink. Use nestjs-pino's `PinoLogger` (not Nest's
 * `Logger`): Nest's Logger treats the last string arg as a context name and
 * would discard Better Auth's message when we pass `{ context }` first.
 */
export type BetterAuthPinoSink = {
  debug: (obj: object, msg?: string) => void;
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

const BETTER_AUTH_CONTEXT = { context: 'BetterAuth' } as const;

/**
 * Fold Better Auth's console-style trailing args into a pino bindings object.
 *
 * Better Auth calls `log(level, message, ...args)` the same way as
 * `console.error(message, err)`. Pino's third+ arguments are printf
 * interpolations only, so Errors/objects must be merged into the first
 * argument or they vanish from structured JSON (and from Loki).
 */
export function buildBetterAuthLogObject(
  ...args: unknown[]
): Record<string, unknown> {
  const obj: Record<string, unknown> = { ...BETTER_AUTH_CONTEXT };
  const extras: unknown[] = [];

  for (const arg of args) {
    if (arg instanceof Error) {
      if (obj.err === undefined) {
        obj.err = arg;
      } else {
        extras.push(arg);
      }
      continue;
    }
    if (arg !== null && typeof arg === 'object' && !Array.isArray(arg)) {
      Object.assign(obj, arg);
      continue;
    }
    if (arg !== undefined) {
      extras.push(arg);
    }
  }

  if (extras.length === 1) {
    obj.detail = extras[0];
  } else if (extras.length > 1) {
    obj.details = extras;
  }

  return obj;
}

/**
 * Route Better Auth's internal logging through a pino sink as structured JSON
 * (`context: "BetterAuth"`, `msg` = Better Auth's message).
 */
export function createBetterAuthPinoLogger(
  sink: BetterAuthPinoSink,
): BetterAuthLogger {
  return {
    disabled: false,
    // Better Auth formats its own timestamps/labels when using the default
    // console logger; we own formatting via pino.
    disableColors: true,
    log: (level, message, ...args) => {
      const obj = buildBetterAuthLogObject(...args);
      switch (level) {
        case 'debug':
          sink.debug(obj, message);
          break;
        case 'info':
          sink.info(obj, message);
          break;
        case 'warn':
          sink.warn(obj, message);
          break;
        case 'error':
          sink.error(obj, message);
          break;
      }
    },
  };
}
