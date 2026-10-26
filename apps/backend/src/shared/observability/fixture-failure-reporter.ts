export type FixtureName = 'demo' | 'e2e';

/**
 * Fixture seeds run from the container entrypoint, before Nest and its Sentry
 * client exist. A demo seed failure is non-fatal there (the API starts anyway),
 * so Sentry is where the broken dataset has to surface.
 *
 * Best-effort: a reporting failure must never mask the fixture error itself.
 * Without a DSN the SDK stays inert, so local dev and CI stay Sentry-free.
 */
export const reportFixtureFailure = async (
  fixture: FixtureName,
  error: unknown,
): Promise<void> => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    return;
  }

  try {
    // Lazy on purpose: these scripts also run from `bun bootstrap`, before
    // turbo builds the workspace packages — `@repo/observability` resolves to
    // a gitignored dist/ that may not exist yet. With no DSN (local dev, CI)
    // neither import happens at all.
    const [{ buildBaseOptions }, Sentry] = await Promise.all([
      import('@repo/observability'),
      import('@sentry/nestjs'),
    ]);

    Sentry.init({
      ...buildBaseOptions({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT,
        release: process.env.SENTRY_RELEASE,
        tracesSampleRateOverride: process.env.SENTRY_TRACES_SAMPLE_RATE,
      }),
      // A fixture failure is a deploy signal; never drop one as client noise.
      ignoreErrors: [],
    });

    const eventId = Sentry.captureException(error, {
      tags: { fixture, stage: 'database-seed' },
    });

    // The seed exits right after this; flush first or the event never leaves
    // the process.
    const delivered = await Sentry.flush(2_000);

    if (eventId) {
      console.error(
        delivered
          ? `Reported ${fixture} fixture failure to Sentry as ${eventId}`
          : `Sentry event ${eventId} for the ${fixture} fixture failure was not delivered before the flush timeout`,
      );
    }
  } catch (reportingError) {
    console.error(
      'Could not report the fixture failure to Sentry:',
      reportingError,
    );
  }
};

/**
 * Runs a fixture seed and funnels any failure through the standard exit path:
 * log the error, report it to Sentry (when configured), then exit 1. Seed
 * failures stay fatal here — the entrypoint alone decides whether a fixture is
 * non-fatal.
 */
export const runFixtureSeed = async (
  fixture: FixtureName,
  seed: () => Promise<void>,
): Promise<void> => {
  try {
    await seed();
  } catch (error) {
    console.error(error);
    await reportFixtureFailure(fixture, error);
    process.exit(1);
  }
};
