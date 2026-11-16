import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray, lt, or, type SQL, sql } from 'drizzle-orm';
import { AuthService } from '../../auth/auth.service';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import { ChangeArea } from '../change-area';
import { UNIT_AREA_PERMISSIONS } from '../change-area-visibility';
import {
  decodeFeedCursor,
  encodeFeedCursor,
  FEED_RETENTION_MS,
  isFeedCursorExpired,
} from '../feed-cursor';
import type { ChangeFeed, ChangeFeedEntry } from '../models/change-feed.model';
import { changeFeedEntries } from '../schemas/change-feed-entry.schema';

const DEFAULT_POLL_MS = 5000;
const MAX_POLL_MS = 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads the append-only change feed for one caller.
 *
 * The feed is a log of writes stamped with the writing transaction's `xid8`,
 * so "changes since cursor" is a single indexed range scan. Visibility is a
 * fixed SQL filter: unit-scoped rows the caller may see (area permission on the
 * header unit) unioned with the caller's own user-scoped rows. The filter is
 * the sole source of rows — nothing is post-filtered in memory.
 */
@Injectable()
export class ChangeFeedService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly authService: AuthService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly configService: ConfigService,
  ) {}

  async changesSince(
    userId: string,
    organizationUnitId: string | undefined,
    cursor: string | null,
  ): Promise<ChangeFeed> {
    const { unitAreas, unitIds } = await this.resolveVisibleScope(
      userId,
      organizationUnitId,
    );

    const decoded = cursor ? decodeFeedCursor(cursor) : null;
    const reset = decoded !== null && isFeedCursorExpired(decoded, new Date());

    // The entry read and the cursor's snapshot xmin must observe the same
    // snapshot, so both run inside one repeatable-read transaction.
    return this.db.transaction(
      async (tx) => {
        let rows: Array<{ id: number; area: string }> = [];

        if (!reset) {
          const visibility = this.buildVisibilityFilter(
            userId,
            unitAreas,
            unitIds,
          );
          const readPredicate = decoded
            ? // Relational Query v2 cannot express `>=` against xid8. The xmin
              // is validated digits-only by the cursor decoder, so inlining it
              // as a quoted literal ('<digits>'::xid8) is both safe (no
              // injection) and the only cast form Postgres accepts — there is
              // no integer/text-to-xid8 cast, only the input function for
              // unknown string literals.
              sql`${changeFeedEntries.xid} >= ${sql.raw(`'${decoded.xmin}'`)}::xid8`
            : sql`${changeFeedEntries.createdAt} > now() - interval '30 seconds'`;

          rows = await tx
            .select({ id: changeFeedEntries.id, area: changeFeedEntries.area })
            .from(changeFeedEntries)
            .where(and(visibility, readPredicate))
            .orderBy(asc(changeFeedEntries.id));
        }

        const xminResult = (await tx.execute(
          sql`select pg_snapshot_xmin(pg_current_snapshot())::text as xmin`,
        )) as unknown as { rows: Array<{ xmin: string }> };
        const xmin = xminResult.rows[0]?.xmin;
        if (!xmin) {
          throw new Error('Failed to read the current transaction snapshot');
        }

        const changes: ChangeFeedEntry[] = rows.map((row) => ({
          id: String(row.id),
          area: row.area as ChangeArea,
        }));

        return {
          cursor: encodeFeedCursor({
            xmin: String(xmin),
            issuedAt: new Date(),
          }),
          changes,
          reset,
          pollAfterMs: this.resolvePollAfterMs(),
        };
      },
      { isolationLevel: 'repeatable read' },
    );
  }

  /**
   * Delete feed rows older than the retention window so the log stays bounded.
   *
   * Rows strictly older than `now - FEED_RETENTION_MS` are removed; a row that
   * sits exactly on the cutoff survives. Returns how many rows were deleted.
   */
  async pruneExpired(now: Date): Promise<{ deleted: number }> {
    const cutoff = new Date(now.getTime() - FEED_RETENTION_MS);

    const deleted = await this.db
      .delete(changeFeedEntries)
      .where(lt(changeFeedEntries.createdAt, cutoff))
      .returning({ id: changeFeedEntries.id });

    return { deleted: deleted.length };
  }

  /**
   * Areas the caller may see unit-wide for the header unit, plus the header's
   * inclusive descendant units. With no header there is no unit scope at all —
   * only the caller's own user-scoped rows remain visible.
   *
   * Permissions are checked before the unit tree is read, so a malformed,
   * deleted or foreign header unit degrades to "own rows only" instead of
   * failing the poll, and a caller with no unit areas costs one lookup.
   */
  private async resolveVisibleScope(
    userId: string,
    organizationUnitId: string | undefined,
  ): Promise<{ unitAreas: ChangeArea[]; unitIds: string[] }> {
    if (!organizationUnitId || !UUID_PATTERN.test(organizationUnitId)) {
      return { unitAreas: [], unitIds: [] };
    }

    const permissionKeys = await this.authService.findUserPermissionKeys(
      userId,
      organizationUnitId,
    );
    const unitAreas = Object.values(ChangeArea).filter((area) =>
      UNIT_AREA_PERMISSIONS[area].every((key) => permissionKeys.has(key)),
    );
    if (unitAreas.length === 0) {
      return { unitAreas: [], unitIds: [] };
    }

    const unitIds =
      await this.organizationUnitDataService.listInclusiveDescendantUnitIds(
        organizationUnitId,
      );

    return { unitAreas, unitIds };
  }

  private buildVisibilityFilter(
    userId: string,
    unitAreas: ChangeArea[],
    unitIds: string[],
  ): SQL {
    const clauses: SQL[] = [];

    if (unitAreas.length > 0 && unitIds.length > 0) {
      const unitClause = and(
        inArray(changeFeedEntries.area, unitAreas),
        inArray(changeFeedEntries.organizationUnitId, unitIds),
      );
      if (unitClause) {
        clauses.push(unitClause);
      }
    }

    clauses.push(eq(changeFeedEntries.userId, userId));

    const [first, ...rest] = clauses;
    if (!first) {
      // Unreachable: the user clause is always pushed above.
      throw new Error('Visibility filter requires at least one clause');
    }
    if (rest.length === 0) {
      return first;
    }
    const combined = or(...clauses);
    if (!combined) {
      throw new Error('Failed to combine visibility clauses');
    }
    return combined;
  }

  /**
   * Read on every call rather than at construction. A value set in the
   * environment is fixed when the process boots, so changing it takes a
   * restart but no client release. Anything that is not a whole number of
   * milliseconds up to an hour falls back to the default.
   */
  private resolvePollAfterMs(): number | null {
    const raw = this.configService.get<string>('CHANGE_FEED_POLL_MS');

    if (raw === 'disabled') {
      return null;
    }

    if (raw === undefined || raw === null || raw === '') {
      return DEFAULT_POLL_MS;
    }

    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_POLL_MS) {
      return DEFAULT_POLL_MS;
    }

    return parsed;
  }
}
