import type { QueryMeta } from '@tanstack/react-query';
import type { ChangeArea } from './query-meta';

/** The retry delay used until the backend has answered once. */
const DEFAULT_POLL_AFTER_MS = 5000;

/**
 * Entries can repeat around a transaction boundary, so the poller drops ids it
 * has already acted on. Only the most recent ones are worth remembering.
 */
const MAX_SEEN_IDS = 1000;

export interface ChangeFeedPollerDeps {
  fetchChanges: (cursor: string | null) => Promise<{
    cursor: string;
    changes: { id: string; area: ChangeArea }[];
    reset: boolean;
    pollAfterMs: number | null;
  }>;
  invalidateAreas: (areas: ReadonlySet<ChangeArea>) => void;
  invalidateAll: () => void;
  isUnauthenticated: (error: unknown) => boolean;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

type ChangeFeedResult = Awaited<
  ReturnType<ChangeFeedPollerDeps['fetchChanges']>
>;

/**
 * Polls the change feed for one tab and turns each answer into query
 * invalidations. It owns no React state and no DOM events: the provider calls
 * `start` / `pause` / `resume` / `stop`, and the timers arrive through `deps`.
 *
 * Invalidation is independent of polling. A `hold` queues invalidations while a
 * form is dirty, and a `pause` only stops the polling, so a release still
 * flushes whatever arrived in the meantime.
 */
export class ChangeFeedPoller {
  private readonly deps: ChangeFeedPollerDeps;
  private cursor: string | null = null;
  private pollAfterMs: number | null = DEFAULT_POLL_AFTER_MS;
  private timer: unknown = undefined;
  private hasTimer = false;
  private inFlight = false;
  private paused = false;
  private stopped = false;
  private holds = 0;
  private heldAreas = new Set<ChangeArea>();
  private heldReset = false;
  private readonly seenIds = new Set<string>();
  private readonly seenOrder: string[] = [];

  constructor(deps: ChangeFeedPollerDeps) {
    this.deps = deps;
  }

  /** Polls immediately, then every `pollAfterMs`. */
  start(): void {
    if (this.stopped) {
      return;
    }
    this.paused = false;
    void this.poll();
  }

  /** Tab hidden: cancel the pending timer, keep the cursor. */
  pause(): void {
    this.paused = true;
    this.clearTimer();
  }

  /** Tab visible / focus / online: poll now, then reschedule. */
  resume(): void {
    if (this.stopped) {
      return;
    }
    this.paused = false;
    if (this.pollAfterMs === null) {
      // A disabled feed stays quiet until the next page load (decision 15).
      return;
    }
    this.clearTimer();
    void this.poll();
  }

  /** Unmount: the poller becomes inert. */
  stop(): void {
    this.stopped = true;
    this.clearTimer();
    this.heldAreas = new Set();
    this.heldReset = false;
  }

  /** Queues invalidations until the returned release is called. */
  hold(): () => void {
    this.holds += 1;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      if (this.holds > 0) {
        this.holds -= 1;
      }
      if (this.holds > 0) {
        return;
      }
      this.flushHeld();
    };
  }

  private async poll(): Promise<void> {
    if (this.stopped || this.inFlight) {
      return;
    }
    this.inFlight = true;
    try {
      const result = await this.deps.fetchChanges(this.cursor);
      this.cursor = result.cursor;
      this.pollAfterMs = result.pollAfterMs;
      this.apply(result);
    } catch (error) {
      if (this.deps.isUnauthenticated(error)) {
        // A background poll never redirects to login; it just goes quiet.
        this.stop();
        return;
      }
      // Any other error keeps the cursor; `schedule` retries after the last
      // known pollAfterMs (5000 before the first answer).
    } finally {
      this.inFlight = false;
    }
    this.schedule();
  }

  private apply(result: ChangeFeedResult): void {
    if (this.stopped) {
      return;
    }
    if (result.reset) {
      for (const change of result.changes) {
        this.remember(change.id);
      }
      this.deliver(new Set(), true);
      return;
    }
    const areas = new Set<ChangeArea>();
    for (const change of result.changes) {
      if (this.remember(change.id)) {
        areas.add(change.area);
      }
    }
    this.deliver(areas, false);
  }

  /** Records an entry id; returns false when it was already seen. */
  private remember(id: string): boolean {
    if (this.seenIds.has(id)) {
      return false;
    }
    this.seenIds.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > MAX_SEEN_IDS) {
      const oldest = this.seenOrder.shift();
      if (oldest !== undefined) {
        this.seenIds.delete(oldest);
      }
    }
    return true;
  }

  private deliver(areas: ReadonlySet<ChangeArea>, reset: boolean): void {
    if (this.stopped) {
      return;
    }
    if (this.holds > 0) {
      if (reset) {
        this.heldReset = true;
      }
      for (const area of areas) {
        this.heldAreas.add(area);
      }
      return;
    }
    if (reset) {
      this.deps.invalidateAll();
      return;
    }
    if (areas.size === 0) {
      return;
    }
    this.deps.invalidateAreas(areas);
  }

  private flushHeld(): void {
    const reset = this.heldReset;
    const areas = this.heldAreas;
    this.heldReset = false;
    this.heldAreas = new Set();
    if (this.stopped) {
      return;
    }
    if (reset) {
      this.deps.invalidateAll();
      return;
    }
    if (areas.size === 0) {
      return;
    }
    this.deps.invalidateAreas(areas);
  }

  private schedule(): void {
    if (this.stopped || this.paused || this.inFlight) {
      return;
    }
    const delay = this.pollAfterMs;
    if (delay === null) {
      return;
    }
    this.clearTimer();
    this.timer = this.deps.setTimer(() => {
      this.timer = undefined;
      this.hasTimer = false;
      void this.poll();
    }, delay);
    this.hasTimer = true;
  }

  private clearTimer(): void {
    if (!this.hasTimer) {
      return;
    }
    this.hasTimer = false;
    const handle = this.timer;
    this.timer = undefined;
    this.deps.clearTimer(handle);
  }
}

/** True when the query declared one of the changed areas in its `meta`. */
export function queryMatchesChangedAreas(
  meta: QueryMeta | undefined,
  areas: ReadonlySet<ChangeArea>,
): boolean {
  const changeAreas = meta?.changeAreas;
  if (!changeAreas || changeAreas.length === 0) {
    return false;
  }
  return changeAreas.some((area) => areas.has(area));
}
