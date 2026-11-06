import type { BetterAuthLogger } from './auth';

/**
 * Minimal pino-shaped sink. Use nestjs-pino's `PinoLogger` (not Nest's
 * `Logger`): Nest's Logger treats the last string arg as a context name and
 * would discard Better Auth's message when we pass `{ context }` first.
 */
export type BetterAuthPinoSink = {
  debug: (obj: object, msg?: string, ...args: unknown[]) => void;
  info: (obj: object, msg?: string, ...args: unknown[]) => void;
  warn: (obj: object, msg?: string, ...args: unknown[]) => void;
  error: (obj: object, msg?: string, ...args: unknown[]) => void;
};

const BETTER_AUTH_CONTEXT = { context: 'BetterAuth' } as const;

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
      switch (level) {
        case 'debug':
          sink.debug(BETTER_AUTH_CONTEXT, message, ...args);
          break;
        case 'info':
          sink.info(BETTER_AUTH_CONTEXT, message, ...args);
          break;
        case 'warn':
          sink.warn(BETTER_AUTH_CONTEXT, message, ...args);
          break;
        case 'error':
          sink.error(BETTER_AUTH_CONTEXT, message, ...args);
          break;
      }
    },
  };
}
