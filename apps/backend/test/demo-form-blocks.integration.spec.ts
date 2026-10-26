import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  ensureFormBlock,
  ensureFormBlockRef,
} from '../src/database/demo-form-blocks';
import { type Database } from '../src/database/fixture-helpers';
import { relations } from '../src/database/relations';
import * as schema from '../src/database/schema';

const USER_ID = 'test-form-blocks-user';

let pool: Pool;
let db: Database;
let organizationId: string;
let otherOrganizationId: string;

beforeAll(async () => {
  if (!process.env.DB_NAME?.includes('_test_')) {
    throw new Error(
      'Refusing to run form-block integration tests against a non-test database',
    );
  }

  pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false,
  });
  db = drizzle({ client: pool, relations });

  await db.insert(schema.users).values({
    id: USER_ID,
    name: 'Test User',
    email: 'test-form-blocks@example.com',
    firstname: 'Test',
    lastname: 'User',
  });

  const [organization] = await db
    .insert(schema.organizations)
    .values({ name: 'Form Blocks Org', slug: 'test-form-blocks-org' })
    .returning();
  const [otherOrganization] = await db
    .insert(schema.organizations)
    .values({ name: 'Other Org', slug: 'test-form-blocks-other-org' })
    .returning();

  if (!organization || !otherOrganization) {
    throw new Error('Failed to create test organizations');
  }

  organizationId = organization.id;
  otherOrganizationId = otherOrganization.id;
});

afterAll(async () => {
  await pool.end();
});

const FIELDS = [
  { type: 'NAME', label: 'Vorname', required: true, fieldOrder: 0 },
  { type: 'LASTNAME', label: 'Nachname', required: true, fieldOrder: 1 },
  { type: 'PHONE', label: 'Telefonnummer', required: false, fieldOrder: 2 },
] as const;

const blockInput = (
  overrides: { organizationId?: string; title?: string } = {},
) => ({
  organizationId,
  title: 'Deine Kontaktdaten',
  description: 'Damit wir dich erreichen können.',
  createdById: USER_ID,
  fields: [...FIELDS],
  ...overrides,
});

describe('ensureFormBlock', () => {
  it('creates a block with its fields once and reuses it by (organization, title)', async () => {
    const first = await ensureFormBlock(db, blockInput());
    const second = await ensureFormBlock(db, blockInput());

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.block.id).toBe(first.block.id);

    expect(
      await db.query.formBlocks.findMany({
        where: { organizationId, title: 'Deine Kontaktdaten' },
      }),
    ).toHaveLength(1);
    expect(
      await db.query.formBlockFields.findMany({
        where: { blockId: first.block.id },
      }),
    ).toHaveLength(3);
  });

  it('never reuses a block from another organization', async () => {
    const other = await ensureFormBlock(
      db,
      blockInput({ organizationId: otherOrganizationId }),
    );
    const ours = await ensureFormBlock(db, blockInput());

    expect(ours.block.id).not.toBe(other.block.id);
    expect(ours.block.organizationId).toBe(organizationId);
  });

  it('leaves an existing block and its fields as an admin left them', async () => {
    const { block } = await ensureFormBlock(db, blockInput());

    await db
      .update(schema.formBlockFields)
      .set({ label: 'Handy' })
      .where(
        and(
          eq(schema.formBlockFields.blockId, block.id),
          eq(schema.formBlockFields.label, 'Telefonnummer'),
        ),
      );
    await db
      .delete(schema.formBlockFields)
      .where(
        and(
          eq(schema.formBlockFields.blockId, block.id),
          eq(schema.formBlockFields.label, 'Nachname'),
        ),
      );

    const again = await ensureFormBlock(db, blockInput());
    expect(again.created).toBe(false);

    const labels = (
      await db.query.formBlockFields.findMany({ where: { blockId: block.id } })
    )
      .map((field) => field.label)
      .sort();
    expect(labels).toEqual(['Handy', 'Vorname']);
  });

  it('populates an existing block that has no fields', async () => {
    const title = 'Leerer Block';
    const [empty] = await db
      .insert(schema.formBlocks)
      .values({
        organizationId,
        title,
        description: 'Left empty by an older seed.',
        createdBy: USER_ID,
        updatedBy: USER_ID,
      })
      .returning();
    if (!empty) {
      throw new Error('Failed to create empty block');
    }

    const result = await ensureFormBlock(db, blockInput({ title }));

    expect(result.block.id).toBe(empty.id);
    expect(result.created).toBe(true);
    expect(
      await db.query.formBlockFields.findMany({ where: { blockId: empty.id } }),
    ).toHaveLength(3);
  });

  it('leaves no empty block behind when writing the fields fails', async () => {
    const title = 'Block with broken fields';

    await expect(
      ensureFormBlock(db, { ...blockInput({ title }), fields: [{} as never] }),
    ).rejects.toThrow();

    expect(
      await db.query.formBlocks.findMany({ where: { organizationId, title } }),
    ).toHaveLength(0);
  });
});

describe('ensureFormBlockRef', () => {
  it('links a form to a block once', async () => {
    const { block } = await ensureFormBlock(db, blockInput());

    const [form] = await db
      .insert(schema.requirementForms)
      .values({
        organizationId,
        slug: 'test-ref-form',
        name: 'Test Ref Form',
        shareToken: crypto.randomUUID(),
        createdBy: USER_ID,
        updatedBy: USER_ID,
      })
      .returning();

    if (!form) {
      throw new Error('Failed to create test form');
    }

    const ref = {
      formId: form.id,
      blockId: block.id,
      fieldOrder: 0,
    };

    await ensureFormBlockRef(db, ref, { fresh: true });
    await ensureFormBlockRef(db, ref, { fresh: true });

    const refs = await db.query.requirementFormBlockRefs.findMany({
      where: { formId: form.id, blockId: block.id },
    });
    expect(refs).toHaveLength(1);
  });

  it('relinks an empty form but leaves a form that has blocks alone', async () => {
    const { block } = await ensureFormBlock(db, blockInput());
    const { block: other } = await ensureFormBlock(
      db,
      blockInput({ title: 'Eigener Block' }),
    );

    const [form] = await db
      .insert(schema.requirementForms)
      .values({
        organizationId,
        slug: 'test-relink-form',
        name: 'Test Relink Form',
        shareToken: crypto.randomUUID(),
        createdBy: USER_ID,
        updatedBy: USER_ID,
      })
      .returning();
    if (!form) {
      throw new Error('Failed to create test form');
    }

    const refTo = (blockId: string) => ({
      formId: form.id,
      blockId,
      fieldOrder: 0,
    });

    await ensureFormBlockRef(db, refTo(block.id), { fresh: false });
    expect(
      await db.query.requirementFormBlockRefs.findMany({
        where: { formId: form.id },
      }),
    ).toHaveLength(1);

    await ensureFormBlockRef(
      db,
      { ...refTo(other.id), fieldOrder: 1 },
      {
        fresh: false,
      },
    );
    expect(
      await db.query.requirementFormBlockRefs.findMany({
        where: { formId: form.id },
      }),
    ).toHaveLength(1);
  });
});
