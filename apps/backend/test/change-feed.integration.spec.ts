import 'reflect-metadata';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  SigneeType,
} from '../src/accounting/enums';
import { PermissionKey } from '../src/auth/enums';
import { ChangeArea } from '../src/change-feed/enums';
import { encodeFeedCursor } from '../src/change-feed/feed-cursor';
import type { ChangeFeedEntryInsert } from '../src/change-feed/schemas/change-feed-entry.schema';
import { ChangeFeedService } from '../src/change-feed/services/change-feed.service';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import {
  createDocumentTemplate,
  createReimbursementType,
} from './factories/accounting.factory';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import {
  assignRoleToMembership,
  createRole,
  grantPermissionToRole,
} from './factories/role.factory';
import { createUser } from './factories/user.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequestRequiringData } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

const CHANGES_SINCE = `
  query ChangesSince($cursor: String) {
    changesSince(cursor: $cursor) {
      cursor
      reset
      pollAfterMs
      changes {
        id
        area
      }
    }
  }
`;

type ChangeFeedPayload = {
  cursor: string;
  reset: boolean;
  pollAfterMs: number | null;
  changes: Array<{ id: string; area: string }>;
};

type Fixture = {
  organizationId: string;
  typeId: string;
  rootId: string;
  childId: string;
};

const originalPollEnv = process.env.CHANGE_FEED_POLL_MS;

describe('changesSince', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  let reimbursementTypeId: string;

  const createFixture = async (): Promise<Fixture> => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Change Feed Query Org ${crypto.randomUUID()}`,
    );
    const root = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    const child = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'child',
      parentId: root.id,
    });
    return {
      organizationId: organization.id,
      typeId: type.id,
      rootId: root.id,
      childId: child.id,
    };
  };

  const permissionRow = async (key: PermissionKey) => {
    const permission = await db.query.permissions.findFirst({
      where: { key },
    });
    if (!permission) throw new Error(`Missing seeded permission ${key}`);
    return permission;
  };

  /** A user with a membership (and optional permission role) in one unit. */
  const createMember = async (
    fixture: Fixture,
    unitId: string,
    keys: PermissionKey[],
  ) => {
    const user = await createUser(db);
    const membership = await addMembership(db, user.id, unitId);
    if (keys.length > 0) {
      const role = await createRole(db, {
        organizationId: fixture.organizationId,
      });
      for (const key of keys) {
        const permission = await permissionRow(key);
        await grantPermissionToRole(db, {
          roleId: role.id,
          permissionId: permission.id,
        });
      }
      await assignRoleToMembership(db, {
        membershipId: membership.id,
        roleId: role.id,
      });
    }
    return user;
  };

  const insertEntry = async (
    values: Partial<ChangeFeedEntryInsert> & { area: ChangeArea },
  ) => {
    const [entry] = await db
      .insert(schema.changeFeedEntries)
      .values({
        area: values.area,
        organizationUnitId: values.organizationUnitId ?? null,
        userId: values.userId ?? null,
        createdAt: values.createdAt,
      })
      .returning();
    if (!entry) throw new Error('Failed to insert change feed entry');
    return entry;
  };

  const poll = async (opts: { cursor?: string; header?: string } = {}) => {
    const variables = opts.cursor === undefined ? {} : { cursor: opts.cursor };
    const headers = opts.header
      ? { 'x-organization-unit-id': opts.header }
      : undefined;
    const data = await graphqlRequestRequiringData<{
      changesSince: ChangeFeedPayload;
    }>(app, { query: CHANGES_SINCE, variables, headers }, 'changesSince');
    return data.changesSince;
  };

  const contractTemplate = (fixture: Fixture) =>
    createDocumentTemplate(db, {
      organizationId: fixture.organizationId,
      organizationUnitId: fixture.rootId,
      reimbursementTypeId,
      kind: DocumentKind.CONTRACT,
      signees: [{ order: 0, signeeType: SigneeType.VOLUNTEER }],
    });

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;
    reimbursementTypeId = (await createReimbursementType(db)).id;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
    if (originalPollEnv === undefined) {
      delete process.env.CHANGE_FEED_POLL_MS;
    } else {
      process.env.CHANGE_FEED_POLL_MS = originalPollEnv;
    }
  });

  it('returns contract and invoice entries for an accounting manager, scoped to the header unit and its children', async () => {
    const fixture = await createFixture();
    const manager = await createMember(fixture, fixture.rootId, [
      PermissionKey.ACCOUNTING_MANAGE,
    ]);
    const otherUser = await createUser(db);
    const foreign = await createFixture();

    const contractEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: fixture.rootId,
      userId: otherUser.id,
    });
    const invoiceEntry = await insertEntry({
      area: ChangeArea.INVOICES,
      organizationUnitId: fixture.childId,
      userId: otherUser.id,
    });
    const membershipEntry = await insertEntry({
      area: ChangeArea.MEMBERSHIP_REQUESTS,
      organizationUnitId: fixture.rootId,
      userId: otherUser.id,
    });
    const foreignEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: foreign.rootId,
      userId: otherUser.id,
    });

    setAuthMockUserId(manager.id);
    const feed = await poll({ header: fixture.rootId });
    const ids = feed.changes.map((change) => change.id);

    expect(ids).toContain(String(contractEntry.id));
    expect(ids).toContain(String(invoiceEntry.id));
    expect(ids).not.toContain(String(membershipEntry.id));
    expect(ids).not.toContain(String(foreignEntry.id));
    expect(feed.changes).toContainEqual({
      id: String(contractEntry.id),
      area: 'CONTRACTS',
    });
    expect(feed.changes).toContainEqual({
      id: String(invoiceEntry.id),
      area: 'INVOICES',
    });
  });

  it('returns no contract entries to a member without accounting:manage', async () => {
    const fixture = await createFixture();
    const volunteer = await createMember(fixture, fixture.rootId, [
      PermissionKey.VOLUNTEER_VIEW,
    ]);
    const otherUser = await createUser(db);

    const contractEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: fixture.rootId,
      userId: otherUser.id,
    });
    const membershipEntry = await insertEntry({
      area: ChangeArea.MEMBERSHIP_REQUESTS,
      organizationUnitId: fixture.rootId,
      userId: otherUser.id,
    });

    setAuthMockUserId(volunteer.id);
    const feed = await poll({ header: fixture.rootId });
    const ids = feed.changes.map((change) => change.id);

    expect(ids).not.toContain(String(contractEntry.id));
    expect(ids).toContain(String(membershipEntry.id));
  });

  it('returns only user entries for a header unit without permission', async () => {
    const fixture = await createFixture();
    const outsider = await createUser(db);
    const otherUser = await createUser(db);

    const unitEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: fixture.rootId,
      userId: otherUser.id,
    });
    const ownEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: fixture.childId,
      userId: outsider.id,
    });

    setAuthMockUserId(outsider.id);
    const feed = await poll({ header: fixture.rootId });
    const ids = feed.changes.map((change) => change.id);

    expect(ids).toContain(String(ownEntry.id));
    expect(ids).not.toContain(String(unitEntry.id));
  });

  it("returns only own entries when an accounting manager sends another org's unit", async () => {
    const managedFixture = await createFixture();
    const foreignFixture = await createFixture();
    const manager = await createMember(managedFixture, managedFixture.rootId, [
      PermissionKey.ACCOUNTING_MANAGE,
    ]);
    const otherUser = await createUser(db);

    const foreignEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: foreignFixture.rootId,
      userId: otherUser.id,
    });
    const ownEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: managedFixture.rootId,
      userId: manager.id,
    });

    setAuthMockUserId(manager.id);
    const feed = await poll({ header: foreignFixture.rootId });
    const ids = feed.changes.map((change) => change.id);

    expect(ids).toContain(String(ownEntry.id));
    expect(ids).not.toContain(String(foreignEntry.id));
  });

  it('returns own entries instead of failing for an unknown or malformed header unit', async () => {
    const caller = await createUser(db);
    const ownEntry = await insertEntry({
      area: ChangeArea.INVOICES,
      userId: caller.id,
    });

    setAuthMockUserId(caller.id);
    for (const header of [crypto.randomUUID(), 'not-a-unit-id']) {
      const feed = await poll({ header });
      expect(feed.changes.map((change) => change.id)).toContain(
        String(ownEntry.id),
      );
    }
  });

  it("returns the caller's own contract entries without a header", async () => {
    const fixture = await createFixture();
    const caller = await createUser(db);

    const ownEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      organizationUnitId: fixture.rootId,
      userId: caller.id,
    });

    setAuthMockUserId(caller.id);
    const feed = await poll();
    const ids = feed.changes.map((change) => change.id);

    expect(ids).toContain(String(ownEntry.id));
    expect(feed.changes).toContainEqual({
      id: String(ownEntry.id),
      area: 'CONTRACTS',
    });
  });

  it("never returns another user's user-scoped entries", async () => {
    const caller = await createUser(db);
    const otherUser = await createUser(db);

    const othersEntry = await insertEntry({
      area: ChangeArea.INVOICES,
      userId: otherUser.id,
    });
    const ownEntry = await insertEntry({
      area: ChangeArea.INVOICES,
      userId: caller.id,
    });

    setAuthMockUserId(caller.id);
    const feed = await poll();
    const ids = feed.changes.map((change) => change.id);

    expect(ids).toContain(String(ownEntry.id));
    expect(ids).not.toContain(String(othersEntry.id));
  });

  it('bootstrap returns entries from the last 30s and none older', async () => {
    const caller = await createUser(db);

    const fresh = await insertEntry({
      area: ChangeArea.CONTRACTS,
      userId: caller.id,
    });
    const old = await insertEntry({
      area: ChangeArea.CONTRACTS,
      userId: caller.id,
      createdAt: new Date(Date.now() - 31_000),
    });

    setAuthMockUserId(caller.id);
    const feed = await poll();
    const ids = feed.changes.map((change) => change.id);

    expect(feed.reset).toBe(false);
    expect(ids).toContain(String(fresh.id));
    expect(ids).not.toContain(String(old.id));
  });

  it('falls back to bootstrap for an undecodable cursor', async () => {
    const caller = await createUser(db);

    const recent = await insertEntry({
      area: ChangeArea.CONTRACTS,
      userId: caller.id,
    });

    setAuthMockUserId(caller.id);
    const feed = await poll({ cursor: 'not-a-cursor' });
    const ids = feed.changes.map((change) => change.id);

    expect(feed.reset).toBe(false);
    expect(ids).toContain(String(recent.id));
    expect(feed.changes).toContainEqual({
      id: String(recent.id),
      area: 'CONTRACTS',
    });
  });

  it('cursor mode returns only entries written after the previous poll', async () => {
    const caller = await createUser(db);
    setAuthMockUserId(caller.id);

    const first = await poll();
    expect(first.changes).toEqual([]);

    const newEntry = await insertEntry({
      area: ChangeArea.CONTRACTS,
      userId: caller.id,
    });

    const second = await poll({ cursor: first.cursor });
    const ids = second.changes.map((change) => change.id);

    expect(ids).toContain(String(newEntry.id));
  });

  it('delivers a row from a transaction still open at the previous poll', async () => {
    const fixture = await createFixture();
    const manager = await createMember(fixture, fixture.rootId, [
      PermissionKey.ACCOUNTING_MANAGE,
    ]);
    const volunteer = await createUser(db);
    const template = await contractTemplate(fixture);

    let releaseTx!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseTx = resolve;
    });
    let markInserted!: () => void;
    const insertDone = new Promise<void>((resolve) => {
      markInserted = resolve;
    });

    const txPromise = db.transaction(async (tx) => {
      await tx.insert(schema.contracts).values({
        documentTemplateId: template.id,
        volunteerId: volunteer.id,
        reimbursementTypeId,
        organizationUnitId: fixture.rootId,
        contractStatus: ContractStatus.ACTIVE,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-01-01T00:00:00.000Z'),
        resolvedBody: { header: {}, blocks: [], footer: {} },
      });
      markInserted();
      await held;
    });

    let released = false;
    const release = async () => {
      if (released) return;
      released = true;
      releaseTx();
      await txPromise;
    };

    try {
      await insertDone;
      setAuthMockUserId(manager.id);

      const first = await poll({ header: fixture.rootId });
      expect(first.changes).toEqual([]);

      await release();

      const [entry] = await db
        .select()
        .from(schema.changeFeedEntries)
        .where(
          and(
            eq(schema.changeFeedEntries.organizationUnitId, fixture.rootId),
            eq(schema.changeFeedEntries.area, ChangeArea.CONTRACTS),
          ),
        )
        .orderBy(schema.changeFeedEntries.id);
      expect(entry).toBeDefined();

      const second = await poll({
        cursor: first.cursor,
        header: fixture.rootId,
      });
      expect(second.changes.map((change) => change.id)).toContain(
        String(entry?.id),
      );
    } finally {
      await release();
    }
  });

  it('answers reset for a cursor older than 24h', async () => {
    setAuthMockUserId(testUserId);
    const staleCursor = encodeFeedCursor({
      xmin: '1',
      issuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    const feed = await poll({ cursor: staleCursor });

    expect(feed.reset).toBe(true);
    expect(feed.changes).toEqual([]);
    expect(typeof feed.cursor).toBe('string');
    expect(feed.cursor.length).toBeGreaterThan(0);

    const next = await poll({ cursor: feed.cursor });
    expect(next.reset).toBe(false);
    expect(Array.isArray(next.changes)).toBe(true);
  });

  it('reports pollAfterMs 5000 by default and null when disabled', async () => {
    setAuthMockUserId(testUserId);

    const first = await poll();
    expect(first.pollAfterMs).toBe(5000);

    process.env.CHANGE_FEED_POLL_MS = 'disabled';
    const second = await poll();
    expect(second.pollAfterMs).toBeNull();
  });

  it('prunes entries older than 24h and keeps newer ones', async () => {
    const caller = await createUser(db);

    const backdated = await insertEntry({
      area: ChangeArea.CONTRACTS,
      userId: caller.id,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    const fresh = await insertEntry({
      area: ChangeArea.CONTRACTS,
      userId: caller.id,
    });

    const service = app.get(ChangeFeedService);
    const result = await service.pruneExpired(new Date());

    expect(result.deleted).toBeGreaterThanOrEqual(1);

    const backdatedRows = await db
      .select()
      .from(schema.changeFeedEntries)
      .where(eq(schema.changeFeedEntries.id, backdated.id));
    expect(backdatedRows).toHaveLength(0);

    const freshRows = await db
      .select()
      .from(schema.changeFeedEntries)
      .where(eq(schema.changeFeedEntries.id, fresh.id));
    expect(freshRows).toHaveLength(1);
  });
});
