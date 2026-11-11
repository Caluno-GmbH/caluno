import 'reflect-metadata';
import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { EventInviteStatus } from '../src/event/enums';
import { ShiftInviteStatus } from '../src/shift/enums';
import { createEvent, createShift, createUser } from './factories';
import { addMembership } from './factories/org.factory';
import {
  applyBunAuthMocks,
  getAuthMockUserId,
  setAuthMockUserId,
} from './helpers/auth-mocks';
import { graphqlRequest } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

/**
 * SHIFT_EDIT on an unrelated org must not privilege invite approval on a
 * resource that lives in another unit. Privilege is computed against the
 * resource's organizationUnitId inside the service.
 */
describe('invite privilege scoped to resource unit', () => {
  let app: INestApplication;
  let db: Database;
  let organizationUnitIdA: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationUnitIdA = context.organizationUnitId;
  });

  it('rejects self-approval of pending invites when SHIFT_EDIT is only in another org', async () => {
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, organizationUnitIdA);

    const { id: shiftId } = await createShift(db, {
      organizationUnitId: organizationUnitIdA,
    });
    await db
      .update(schema.shifts)
      .set({ joinRequiresApproval: true })
      .where(eq(schema.shifts.id, shiftId));

    const instance = await db.query.shiftInstances.findFirst({
      where: { masterId: shiftId },
    });
    if (!instance) {
      throw new Error('Expected shift instance');
    }

    await db.insert(schema.shiftInvites).values({
      shiftId,
      userId: volunteer.id,
      status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    });
    await db.insert(schema.shiftInstanceInvites).values({
      instanceId: instance.id,
      userId: volunteer.id,
      status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    });

    const event = await createEvent(db, {
      organizationUnitId: organizationUnitIdA,
    });
    await db
      .update(schema.events)
      .set({ joinRequiresApproval: true })
      .where(eq(schema.events.id, event.id));
    await db.insert(schema.eventInvites).values({
      eventId: event.id,
      userId: volunteer.id,
      status: EventInviteStatus.AWAITING_ADMIN_APPROVAL,
    });

    const originalUserId = getAuthMockUserId();
    setAuthMockUserId(volunteer.id);
    try {
      const createOrgData = await graphqlRequest<{
        createOrganization: { id: string };
      }>(app, {
        query: `
          mutation CreateOrganization($input: CreateOrganizationInput!) {
            createOrganization(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            name: `Cross-Org Privilege ${crypto.randomUUID()}`,
            contactEmail: `cross-org-${crypto.randomUUID()}@example.com`,
          },
        },
      });
      expect(createOrgData.errors).toBeUndefined();
      const organizationIdB = createOrgData.data?.createOrganization.id;
      if (!organizationIdB) {
        throw new Error('Expected createOrganization to return an id');
      }

      const unitB = await db.query.organizationUnits.findFirst({
        where: { organizationId: organizationIdB, parentId: { isNull: true } },
      });
      if (!unitB) {
        throw new Error('Expected root unit for org B');
      }

      const headers = { 'x-organization-unit-id': unitB.id };

      const shiftSeriesResponse = await graphqlRequest(app, {
        query: `
          mutation UpdateShiftInviteStatus(
            $shiftId: String!
            $status: ShiftInviteStatus!
          ) {
            updateShiftInviteStatus(shiftId: $shiftId, status: $status) {
              status
            }
          }
        `,
        variables: { shiftId, status: ShiftInviteStatus.JOINED },
        headers,
      });
      expect(shiftSeriesResponse.errors?.[0]?.message).toMatch(
        /permission|Forbidden/i,
      );

      const shiftInstanceResponse = await graphqlRequest(app, {
        query: `
          mutation UpdateShiftInstanceInviteStatus(
            $instanceId: String!
            $status: ShiftInviteStatus!
          ) {
            updateShiftInstanceInviteStatus(
              instanceId: $instanceId
              status: $status
            ) {
              status
            }
          }
        `,
        variables: {
          instanceId: instance.id,
          status: ShiftInviteStatus.JOINED,
        },
        headers,
      });
      expect(shiftInstanceResponse.errors?.[0]?.message).toMatch(
        /permission|Forbidden/i,
      );

      const eventResponse = await graphqlRequest(app, {
        query: `
          mutation UpdateEventInviteStatus(
            $eventId: ID!
            $status: EventInviteStatus!
          ) {
            updateEventInviteStatus(eventId: $eventId, status: $status) {
              status
            }
          }
        `,
        variables: { eventId: event.id, status: EventInviteStatus.JOINED },
        headers,
      });
      expect(eventResponse.errors?.[0]?.message).toMatch(
        /permission|Forbidden/i,
      );

      const seriesInvite = await db.query.shiftInvites.findFirst({
        where: { shiftId, userId: volunteer.id },
      });
      const instanceInvite = await db.query.shiftInstanceInvites.findFirst({
        where: { instanceId: instance.id, userId: volunteer.id },
      });
      const eventInvite = await db.query.eventInvites.findFirst({
        where: { eventId: event.id, userId: volunteer.id },
      });
      expect(seriesInvite?.status).toBe(
        ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      );
      expect(instanceInvite?.status).toBe(
        ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      );
      expect(eventInvite?.status).toBe(
        EventInviteStatus.AWAITING_ADMIN_APPROVAL,
      );
    } finally {
      setAuthMockUserId(originalUserId);
    }
  });

  it('rejects undoing an admin rejection when SHIFT_EDIT is only in another org', async () => {
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, organizationUnitIdA);

    const { id: shiftId } = await createShift(db, {
      organizationUnitId: organizationUnitIdA,
    });
    const instance = await db.query.shiftInstances.findFirst({
      where: { masterId: shiftId },
    });
    if (!instance) {
      throw new Error('Expected shift instance');
    }

    await db.insert(schema.shiftInvites).values({
      shiftId,
      userId: volunteer.id,
      status: ShiftInviteStatus.ADMIN_REJECTED,
    });
    await db.insert(schema.shiftInstanceInvites).values({
      instanceId: instance.id,
      userId: volunteer.id,
      status: ShiftInviteStatus.ADMIN_REJECTED,
    });

    const event = await createEvent(db, {
      organizationUnitId: organizationUnitIdA,
    });
    await db.insert(schema.eventInvites).values({
      eventId: event.id,
      userId: volunteer.id,
      status: EventInviteStatus.ADMIN_REJECTED,
    });

    const originalUserId = getAuthMockUserId();
    setAuthMockUserId(volunteer.id);
    try {
      const createOrgData = await graphqlRequest<{
        createOrganization: { id: string };
      }>(app, {
        query: `
          mutation CreateOrganization($input: CreateOrganizationInput!) {
            createOrganization(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            name: `Cross-Org Rejection ${crypto.randomUUID()}`,
            contactEmail: `cross-org-${crypto.randomUUID()}@example.com`,
          },
        },
      });
      expect(createOrgData.errors).toBeUndefined();
      const organizationIdB = createOrgData.data?.createOrganization.id;
      if (!organizationIdB) {
        throw new Error('Expected createOrganization to return an id');
      }

      const unitB = await db.query.organizationUnits.findFirst({
        where: { organizationId: organizationIdB, parentId: { isNull: true } },
      });
      if (!unitB) {
        throw new Error('Expected root unit for org B');
      }

      const headers = { 'x-organization-unit-id': unitB.id };

      const shiftSeriesInviteResponse = await graphqlRequest<{
        updateShiftInviteStatus?: { status: string } | null;
      }>(app, {
        query: `
          mutation UpdateShiftInviteStatus(
            $shiftId: String!
            $status: ShiftInviteStatus!
          ) {
            updateShiftInviteStatus(shiftId: $shiftId, status: $status) {
              status
            }
          }
        `,
        variables: { shiftId, status: ShiftInviteStatus.ADMIN_INVITED },
        headers,
      });
      expect(shiftSeriesInviteResponse.errors).toBeDefined();
      expect(
        shiftSeriesInviteResponse.data?.updateShiftInviteStatus,
      ).toBeFalsy();

      const shiftSeriesJoinResponse = await graphqlRequest(app, {
        query: `
          mutation UpdateShiftInviteStatus(
            $shiftId: String!
            $status: ShiftInviteStatus!
          ) {
            updateShiftInviteStatus(shiftId: $shiftId, status: $status) {
              status
            }
          }
        `,
        variables: { shiftId, status: ShiftInviteStatus.JOINED },
        headers,
      });
      expect(shiftSeriesJoinResponse.errors?.[0]?.message).toMatch(
        /permission|Forbidden/i,
      );

      const shiftInstanceInviteResponse = await graphqlRequest<{
        updateShiftInstanceInviteStatus?: { status: string } | null;
      }>(app, {
        query: `
          mutation UpdateShiftInstanceInviteStatus(
            $instanceId: String!
            $status: ShiftInviteStatus!
          ) {
            updateShiftInstanceInviteStatus(
              instanceId: $instanceId
              status: $status
            ) {
              status
            }
          }
        `,
        variables: {
          instanceId: instance.id,
          status: ShiftInviteStatus.ADMIN_INVITED,
        },
        headers,
      });
      expect(shiftInstanceInviteResponse.errors).toBeDefined();
      expect(
        shiftInstanceInviteResponse.data?.updateShiftInstanceInviteStatus,
      ).toBeFalsy();

      const shiftInstanceJoinResponse = await graphqlRequest(app, {
        query: `
          mutation UpdateShiftInstanceInviteStatus(
            $instanceId: String!
            $status: ShiftInviteStatus!
          ) {
            updateShiftInstanceInviteStatus(
              instanceId: $instanceId
              status: $status
            ) {
              status
            }
          }
        `,
        variables: {
          instanceId: instance.id,
          status: ShiftInviteStatus.JOINED,
        },
        headers,
      });
      expect(shiftInstanceJoinResponse.errors?.[0]?.message).toMatch(
        /permission|Forbidden/i,
      );

      const eventInviteResponse = await graphqlRequest<{
        updateEventInviteStatus?: { status: string } | null;
      }>(app, {
        query: `
          mutation UpdateEventInviteStatus(
            $eventId: ID!
            $status: EventInviteStatus!
          ) {
            updateEventInviteStatus(eventId: $eventId, status: $status) {
              status
            }
          }
        `,
        variables: {
          eventId: event.id,
          status: EventInviteStatus.ADMIN_INVITED,
        },
        headers,
      });
      expect(eventInviteResponse.errors).toBeDefined();
      expect(eventInviteResponse.data?.updateEventInviteStatus).toBeFalsy();

      const eventJoinResponse = await graphqlRequest(app, {
        query: `
          mutation UpdateEventInviteStatus(
            $eventId: ID!
            $status: EventInviteStatus!
          ) {
            updateEventInviteStatus(eventId: $eventId, status: $status) {
              status
            }
          }
        `,
        variables: { eventId: event.id, status: EventInviteStatus.JOINED },
        headers,
      });
      expect(eventJoinResponse.errors?.[0]?.message).toMatch(
        /permission|Forbidden/i,
      );

      const seriesInvite = await db.query.shiftInvites.findFirst({
        where: { shiftId, userId: volunteer.id },
      });
      const instanceInvite = await db.query.shiftInstanceInvites.findFirst({
        where: { instanceId: instance.id, userId: volunteer.id },
      });
      const eventInvite = await db.query.eventInvites.findFirst({
        where: { eventId: event.id, userId: volunteer.id },
      });
      expect(seriesInvite?.status).toBe(ShiftInviteStatus.ADMIN_REJECTED);
      expect(instanceInvite?.status).toBe(ShiftInviteStatus.ADMIN_REJECTED);
      expect(eventInvite?.status).toBe(EventInviteStatus.ADMIN_REJECTED);
    } finally {
      setAuthMockUserId(originalUserId);
    }
  });
});
