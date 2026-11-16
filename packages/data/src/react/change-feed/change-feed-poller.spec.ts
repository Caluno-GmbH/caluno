import { describe, expect, it } from 'bun:test';
import {
  ChangeFeedPoller,
  type ChangeFeedPollerDeps,
  queryMatchesChangedAreas,
} from './change-feed-poller';
import { ChangeArea } from './query-meta';

const UNAUTHENTICATED = 'UNAUTHENTICATED';

type FeedResult = Awaited<ReturnType<ChangeFeedPollerDeps['fetchChanges']>>;
type ScriptedStep = FeedResult | Error;

async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

// The poller only touches timers through its `setTimer` / `clearTimer` seam, so
// the tests drive a hand-rolled clock instead of real time.
function createClock() {
  let now = 0;
  let nextHandle = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const delays: number[] = [];

  return {
    delays,
    setTimer(run: () => void, ms: number): unknown {
      const handle = nextHandle;
      nextHandle += 1;
      delays.push(ms);
      timers.set(handle, { at: now + ms, run });
      return handle;
    },
    clearTimer(handle: unknown): void {
      if (typeof handle === 'number') {
        timers.delete(handle);
      }
    },
    get pending(): number {
      return timers.size;
    },
    async advance(ms: number): Promise<void> {
      const target = now + ms;
      await flushPromises();
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (due === undefined) {
          break;
        }
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
        // Let the poll's promise settle before looking for the next timer.
        await flushPromises();
      }
      now = target;
    },
  };
}

function feedResponse(overrides: Partial<FeedResult> = {}): FeedResult {
  return {
    cursor: 'cursor-1',
    changes: [],
    reset: false,
    pollAfterMs: 5000,
    ...overrides,
  };
}

function createHarness() {
  const clock = createClock();
  const script: ScriptedStep[] = [];
  const cursors: (string | null)[] = [];
  const invalidations: ChangeArea[][] = [];
  let invalidateAllCount = 0;

  const poller = new ChangeFeedPoller({
    fetchChanges: async (cursor) => {
      cursors.push(cursor);
      const step = script.shift();
      if (step === undefined) {
        throw new Error('poll without a scripted answer');
      }
      if (step instanceof Error) {
        throw step;
      }
      return step;
    },
    invalidateAreas(areas) {
      invalidations.push([...areas].sort());
    },
    invalidateAll() {
      invalidateAllCount += 1;
    },
    isUnauthenticated(error) {
      return error instanceof Error && error.message === UNAUTHENTICATED;
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  return {
    clock,
    poller,
    cursors,
    invalidations,
    get invalidateAllCount(): number {
      return invalidateAllCount;
    },
    script(...steps: ScriptedStep[]): void {
      script.push(...steps);
    },
  };
}

describe('ChangeFeedPoller', () => {
  it('first poll sends a null cursor and later polls send the returned cursor', async () => {
    const harness = createHarness();
    harness.script(
      feedResponse({ cursor: 'cursor-1' }),
      feedResponse({ cursor: 'cursor-2' }),
    );

    harness.poller.start();
    await flushPromises();
    expect(harness.cursors).toEqual([null]);

    await harness.clock.advance(5000);
    expect(harness.cursors).toEqual([null, 'cursor-1']);
  });

  it('invalidates each changed area once per poll even when many entries share it', async () => {
    const harness = createHarness();
    harness.script(
      feedResponse({
        changes: [
          { id: 'entry-1', area: ChangeArea.Contracts },
          { id: 'entry-2', area: ChangeArea.Contracts },
          { id: 'entry-3', area: ChangeArea.Invoices },
        ],
      }),
    );

    harness.poller.start();
    await flushPromises();

    expect(harness.invalidations).toEqual([
      [ChangeArea.Contracts, ChangeArea.Invoices],
    ]);
  });

  it('ignores an entry id it has already seen', async () => {
    const harness = createHarness();
    harness.script(
      feedResponse({
        cursor: 'cursor-1',
        changes: [{ id: 'entry-1', area: ChangeArea.Contracts }],
      }),
      // The same entry comes back with the next cursor, as it can around a
      // transaction boundary; only the new entry may count.
      feedResponse({
        cursor: 'cursor-2',
        changes: [
          { id: 'entry-1', area: ChangeArea.Contracts },
          { id: 'entry-2', area: ChangeArea.Invoices },
        ],
      }),
    );

    harness.poller.start();
    await flushPromises();
    await harness.clock.advance(5000);

    expect(harness.invalidations).toEqual([
      [ChangeArea.Contracts],
      [ChangeArea.Invoices],
    ]);
  });

  it('invalidates everything once on reset', async () => {
    const harness = createHarness();
    harness.script(
      feedResponse({
        cursor: 'cursor-9',
        reset: true,
        changes: [{ id: 'entry-1', area: ChangeArea.Contracts }],
      }),
    );

    harness.poller.start();
    await flushPromises();

    expect(harness.invalidateAllCount).toBe(1);
    expect(harness.invalidations).toEqual([]);

    // A reset that arrives during a hold waits for the release, and then it is
    // still a single invalidateAll — never an area invalidation beside it.
    const held = createHarness();
    const release = held.poller.hold();
    held.script(feedResponse({ reset: true }));
    held.poller.start();
    await flushPromises();
    expect(held.invalidateAllCount).toBe(0);

    release();
    expect(held.invalidateAllCount).toBe(1);
    expect(held.invalidations).toEqual([]);
  });

  it('queues invalidations while held and flushes once on release', async () => {
    const harness = createHarness();
    const release = harness.poller.hold();
    harness.script(
      feedResponse({
        cursor: 'cursor-1',
        changes: [{ id: 'entry-1', area: ChangeArea.Contracts }],
      }),
      feedResponse({
        cursor: 'cursor-2',
        changes: [{ id: 'entry-2', area: ChangeArea.Invoices }],
      }),
    );

    harness.poller.start();
    await flushPromises();
    await harness.clock.advance(5000);

    // Polling keeps running while held; only the invalidations queue up.
    expect(harness.cursors).toEqual([null, 'cursor-1']);
    expect(harness.invalidations).toEqual([]);

    release();
    expect(harness.invalidations).toEqual([
      [ChangeArea.Contracts, ChangeArea.Invoices],
    ]);
  });

  it('keeps queuing until the last of two holds is released', async () => {
    const harness = createHarness();
    const releaseFirst = harness.poller.hold();
    const releaseSecond = harness.poller.hold();
    harness.script(
      feedResponse({
        cursor: 'cursor-1',
        changes: [{ id: 'entry-1', area: ChangeArea.Contracts }],
      }),
      feedResponse({
        cursor: 'cursor-2',
        changes: [{ id: 'entry-2', area: ChangeArea.Invoices }],
      }),
    );

    harness.poller.start();
    await flushPromises();
    await harness.clock.advance(5000);

    releaseFirst();
    expect(harness.invalidations).toEqual([]);

    // Releasing the same hold twice must not flush early.
    releaseFirst();
    expect(harness.invalidations).toEqual([]);

    releaseSecond();
    expect(harness.invalidations).toEqual([
      [ChangeArea.Contracts, ChangeArea.Invoices],
    ]);
  });

  it('stops scheduling when pollAfterMs is null', async () => {
    const harness = createHarness();
    harness.script(feedResponse({ cursor: 'cursor-1', pollAfterMs: null }));

    harness.poller.start();
    await flushPromises();

    expect(harness.cursors).toEqual([null]);
    expect(harness.clock.pending).toBe(0);

    await harness.clock.advance(60000);
    // Decision 15: a disabled feed stays quiet until the next page load.
    harness.poller.resume();
    await flushPromises();

    expect(harness.cursors).toEqual([null]);
    expect(harness.clock.pending).toBe(0);
  });

  it('stops on an UNAUTHENTICATED error without retrying', async () => {
    const harness = createHarness();
    harness.script(new Error(UNAUTHENTICATED));

    harness.poller.start();
    await flushPromises();

    expect(harness.clock.pending).toBe(0);

    await harness.clock.advance(60000);
    harness.poller.resume();
    harness.poller.start();
    await flushPromises();

    expect(harness.cursors).toEqual([null]);
    expect(harness.clock.pending).toBe(0);
  });

  it('retries after a network error with the same cursor', async () => {
    const harness = createHarness();
    harness.script(
      new Error('socket hang up'),
      feedResponse({ cursor: 'cursor-1', pollAfterMs: 2000 }),
      new Error('socket hang up again'),
      feedResponse({ cursor: 'cursor-2', pollAfterMs: 2000 }),
    );

    harness.poller.start();
    await flushPromises();
    expect(harness.cursors).toEqual([null]);
    // 5000 ms before the backend has answered once.
    expect(harness.clock.delays).toEqual([5000]);

    await harness.clock.advance(5000);
    expect(harness.cursors).toEqual([null, null]);
    // After an answer the last pollAfterMs drives the retry delay.
    expect(harness.clock.delays).toEqual([5000, 2000]);

    await harness.clock.advance(2000);
    // The failed poll kept the cursor the successful answer returned.
    expect(harness.cursors).toEqual([null, null, 'cursor-1']);
    expect(harness.clock.delays).toEqual([5000, 2000, 2000]);
  });

  it('pause cancels the timer and resume polls immediately', async () => {
    const harness = createHarness();
    harness.script(
      feedResponse({ cursor: 'cursor-1' }),
      feedResponse({ cursor: 'cursor-2' }),
    );

    harness.poller.start();
    await flushPromises();
    expect(harness.clock.pending).toBe(1);

    harness.poller.pause();
    expect(harness.clock.pending).toBe(0);

    await harness.clock.advance(20000);
    expect(harness.cursors).toEqual([null]);

    harness.poller.resume();
    await flushPromises();

    expect(harness.cursors).toEqual([null, 'cursor-1']);
    expect(harness.clock.pending).toBe(1);
  });

  it('forgets the oldest entry ids past the FIFO cap and re-delivers them as new', async () => {
    const harness = createHarness();
    // 1001 distinct ids in one answer push the remember-cap past its 1000
    // slots, so `entry-0` is the first id evicted.
    const manyChanges = Array.from({ length: 1001 }, (_, index) => ({
      id: `entry-${index}`,
      area: ChangeArea.Contracts,
    }));
    harness.script(
      feedResponse({ cursor: 'cursor-1', changes: manyChanges }),
      // Re-deliver the evicted oldest id beside an id that is still remembered:
      // only the evicted one may be treated as new.
      feedResponse({
        cursor: 'cursor-2',
        changes: [
          { id: 'entry-0', area: ChangeArea.Invoices },
          { id: 'entry-500', area: ChangeArea.MembershipRequests },
        ],
      }),
    );

    harness.poller.start();
    await flushPromises();
    await harness.clock.advance(5000);

    // First poll invalidates the whole flushed batch; the second poll only
    // invalidates the re-delivered, since-evicted `entry-0` — never the entry
    // that is still remembered.
    expect(harness.invalidations).toEqual([
      [ChangeArea.Contracts],
      [ChangeArea.Invoices],
    ]);
  });

  it('does not start a second poll while one is in flight, and schedules exactly one follow-up on resume', async () => {
    const clock = createClock();
    const invalidations: ChangeArea[][] = [];
    const gates: (() => void)[] = [];
    let fetchCount = 0;

    const poller = new ChangeFeedPoller({
      fetchChanges(): Promise<FeedResult> {
        fetchCount += 1;
        const cursor = `cursor-${fetchCount}`;
        return new Promise<FeedResult>((resolve) => {
          gates.push(() => resolve(feedResponse({ cursor })));
        });
      },
      invalidateAreas(areas) {
        invalidations.push([...areas].sort());
      },
      invalidateAll() {
        invalidations.push([]);
      },
      isUnauthenticated() {
        return false;
      },
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });

    poller.start();
    // The first poll is in flight (its fetch is unresolved).
    expect(fetchCount).toBe(1);

    // A resume during the in-flight poll must not launch an overlapping
    // request: `poll` bails out while `inFlight` is true.
    poller.resume();
    expect(fetchCount).toBe(1);

    // Resolving the in-flight poll schedules exactly one follow-up timer.
    gates.shift()?.();
    await flushPromises();
    expect(fetchCount).toBe(1);
    expect(clock.pending).toBe(1);

    // Advancing to that timer starts the single follow-up poll — no duplicate.
    await clock.advance(5000);
    expect(fetchCount).toBe(2);
    expect(invalidations).toEqual([]);
  });
});

describe('queryMatchesChangedAreas', () => {
  it('matches on any shared area and ignores queries without meta', () => {
    const changed = new Set([ChangeArea.Contracts]);

    expect(
      queryMatchesChangedAreas(
        { changeAreas: [ChangeArea.Invoices, ChangeArea.Contracts] },
        changed,
      ),
    ).toBe(true);
    expect(
      queryMatchesChangedAreas({ changeAreas: [ChangeArea.Invoices] }, changed),
    ).toBe(false);
    expect(queryMatchesChangedAreas({ changeAreas: [] }, changed)).toBe(false);
    expect(queryMatchesChangedAreas({}, changed)).toBe(false);
    expect(queryMatchesChangedAreas(undefined, changed)).toBe(false);
  });
});
