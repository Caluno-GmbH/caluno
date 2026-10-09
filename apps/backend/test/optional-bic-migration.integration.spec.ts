import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

// VOLI-1544 backfill. Runs the real migration file against a temp
// "document_templates" table: pg_temp is searched before public, so the
// unmodified SQL only ever sees the rows each test inserts, and the
// transaction is rolled back afterwards.
const MIGRATION_STATEMENTS = readFileSync(
  join(
    __dirname,
    '../src/database/migrations/20261008132104_optional_bic_agreement_templates/migration.sql',
  ),
  'utf8',
)
  .split('--> statement-breakpoint')
  .filter((statement) => statement.trim());

type Line = { id: string; optional?: boolean; enabled?: boolean };
type Body = { blocks: unknown[] };

const IBAN = { id: 'volunteer-iban', optional: false, enabled: true };
const MANDATORY_BIC = { id: 'payout-bic', optional: false, enabled: true };

describe('optional BIC template backfill (VOLI-1544)', () => {
  let client: Client;

  beforeEach(async () => {
    client = new Client({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    await client.connect();
    await client.query('BEGIN');
    await client.query(
      'CREATE TEMP TABLE "document_templates" ("id" int, "kind" text, "body" jsonb) ON COMMIT DROP',
    );
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
    await client.end();
  });

  async function migrate(
    rows: Array<{ kind: string; body: unknown }>,
  ): Promise<Body[]> {
    for (const [id, row] of rows.entries()) {
      await client.query(
        'INSERT INTO "document_templates" VALUES ($1, $2, $3)',
        [id, row.kind, JSON.stringify(row.body)],
      );
    }
    for (const statement of MIGRATION_STATEMENTS) {
      await client.query(statement);
    }
    const { rows: migrated } = await client.query<{ body: Body }>(
      'SELECT "body" FROM "document_templates" ORDER BY "id"',
    );
    return migrated.map((row) => row.body);
  }

  const textBlock = (lines: unknown) => ({ kind: 'text', lines });
  const linesOf = (body: Body, index: number) =>
    (body.blocks[index] as { lines: Line[] }).lines;

  it('Switches the mandatory agreement BIC line to optional and off', async () => {
    const [body] = await migrate([
      { kind: 'CONTRACT', body: { blocks: [textBlock([MANDATORY_BIC])] } },
    ]);

    expect(linesOf(body, 0)).toEqual([
      { id: 'payout-bic', optional: true, enabled: false },
    ]);
  });

  it('Leaves a BIC line a coordinator already opted into', async () => {
    const optedIn = { id: 'payout-bic', optional: true, enabled: true };
    const [body] = await migrate([
      { kind: 'CONTRACT', body: { blocks: [textBlock([optedIn])] } },
    ]);

    expect(linesOf(body, 0)).toEqual([optedIn]);
  });

  it('Keeps empty and malformed blocks intact instead of nulling them', async () => {
    const blocks = [
      textBlock([]),
      textBlock({ unexpected: true }),
      { kind: 'table' },
      textBlock([MANDATORY_BIC]),
    ];
    const [body] = await migrate([{ kind: 'CONTRACT', body: { blocks } }]);

    expect(body.blocks.slice(0, 3)).toEqual(blocks.slice(0, 3));
  });

  it('Inserts an opt-in BIC line right after the timesheet IBAN', async () => {
    const after = { id: 'after-iban' };
    const [body] = await migrate([
      { kind: 'INVOICE', body: { blocks: [textBlock([IBAN, after])] } },
    ]);

    expect(linesOf(body, 0)).toEqual([
      IBAN,
      {
        id: 'volunteer-bic',
        text: '{volunteerBic} (BIC)',
        fields: [
          {
            id: 'volunteer-bic-field',
            value: { kind: 'bound', source: 'volunteer_bic' },
          },
        ],
        optional: true,
        enabled: false,
      },
      after,
    ]);
  });

  it('Does not add a second BIC line to a timesheet that has one', async () => {
    const bic = { id: 'volunteer-bic', optional: true, enabled: true };
    const [body] = await migrate([
      { kind: 'INVOICE', body: { blocks: [textBlock([IBAN, bic])] } },
    ]);

    expect(linesOf(body, 0)).toEqual([IBAN, bic]);
  });

  it('Rewrites each row from its own body only', async () => {
    const contract = { blocks: [textBlock([{ id: 'other' }])] };
    const invoice = { blocks: [textBlock([{ id: 'other' }])] };
    const [untouchedContract, untouchedInvoice] = await migrate([
      { kind: 'CONTRACT', body: contract },
      { kind: 'INVOICE', body: invoice },
      { kind: 'CONTRACT', body: { blocks: [textBlock([MANDATORY_BIC])] } },
      { kind: 'INVOICE', body: { blocks: [textBlock([IBAN])] } },
    ]);

    expect(untouchedContract).toEqual(contract);
    expect(untouchedInvoice).toEqual(invoice);
  });
});
