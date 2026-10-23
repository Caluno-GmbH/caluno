import { inflateSync } from 'node:zlib';
import { NestFactory } from '@nestjs/core';
import { and, eq, exists, isNotNull } from 'drizzle-orm';
import type { Pool } from 'pg';
import { SigneeType } from '../src/accounting/enums';
import { ContractService } from '../src/accounting/services/contract.service';
import { DocumentRenderingService } from '../src/accounting/services/document-rendering.service';
import { InvoiceService } from '../src/accounting/services/invoice.service';
import { AppModule } from '../src/app.module';
import type { Database } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import { FilePurpose } from '../src/storage/enums';
import { FileService } from '../src/storage/services/file.service';

// One-off: re-renders PDFs stored before the organisation seat named the
// countersigner. A PDF is replaced only when its text matches an old-style
// render exactly, so nothing but the seat changes. Usage: [--apply]

const APPLY = process.argv.includes('--apply');
const LOCK_KEY = 874213087;

type Document = Parameters<DocumentRenderingService['generatePdf']>[0];

interface Field {
  id: string;
  value?: { kind?: string; source?: string };
}

interface Line {
  fields?: Field[];
}

interface Body {
  header?: { orgIdentityLine?: Line; metaLines?: Line[] };
  blocks?: Array<{ line?: Line; lines?: Line[] }>;
  footer?: { closingLine?: Line };
}

function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const chunks: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      content = match[1];
    }
    chunks.push(
      [...content.matchAll(/<([0-9A-Fa-f]+)>/g)]
        .map((m) =>
          Buffer.from(m[1].length % 2 ? `${m[1]}0` : m[1], 'hex').toString(
            'latin1',
          ),
        )
        .join(''),
    );
  }
  return chunks.join('\n');
}

function generatedDateFieldIds(body: Body): string[] {
  const lines: Line[] = [
    body.header?.orgIdentityLine ?? {},
    ...(body.header?.metaLines ?? []),
    ...(body.blocks ?? []).flatMap((block) => [
      block.line ?? {},
      ...(block.lines ?? []),
    ]),
    body.footer?.closingLine ?? {},
  ];
  return lines
    .flatMap((line) => line.fields ?? [])
    .filter(
      (field) =>
        field.value?.kind === 'bound' &&
        field.value.source === 'generated_date',
    )
    .map((field) => field.id);
}

const berlinDate = (date: Date) =>
  new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(date);

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const db = app.get<Database>(DATABASE_CONNECTION);
  const renderer = app.get(DocumentRenderingService);
  const fileService = app.get(FileService);
  const contractService = app.get(ContractService);
  const invoiceService = app.get(InvoiceService);

  const pool = (db as unknown as { $client: Pool }).$client;
  const lock = await pool.connect();
  const counts = { replaced: 0, current: 0, review: 0, failed: 0 };

  try {
    const { rows } = await lock.query<{ locked: boolean }>(
      'select pg_try_advisory_lock($1) as locked',
      [LOCK_KEY],
    );
    if (!rows[0]?.locked) {
      console.log('rerender-signer-names: another run holds the lock');
      return;
    }

    const signedContracts = await db
      .select({ id: schema.contracts.id })
      .from(schema.contracts)
      .where(
        and(
          isNotNull(schema.contracts.fileId),
          exists(
            db
              .select()
              .from(schema.contractSignatures)
              .where(
                and(
                  eq(schema.contractSignatures.contractId, schema.contracts.id),
                  eq(
                    schema.contractSignatures.signeeType,
                    SigneeType.PERMISSION_HOLDER,
                  ),
                  isNotNull(schema.contractSignatures.signedByName),
                ),
              ),
          ),
        ),
      );
    const signedInvoices = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(
        and(
          isNotNull(schema.invoices.fileId),
          exists(
            db
              .select()
              .from(schema.invoiceSignatures)
              .where(
                and(
                  eq(schema.invoiceSignatures.invoiceId, schema.invoices.id),
                  eq(
                    schema.invoiceSignatures.signeeType,
                    SigneeType.PERMISSION_HOLDER,
                  ),
                  isNotNull(schema.invoiceSignatures.signedByName),
                ),
              ),
          ),
        ),
      );

    const documents: Array<{ kind: 'contract' | 'invoice'; id: string }> = [
      ...signedContracts.map(({ id }) => ({ kind: 'contract' as const, id })),
      ...signedInvoices.map(({ id }) => ({ kind: 'invoice' as const, id })),
    ];
    console.log(
      `rerender-signer-names: ${documents.length} countersigned documents${APPLY ? '' : ' (dry run)'}`,
    );

    for (const { kind, id } of documents) {
      try {
        const document: Document =
          kind === 'contract'
            ? await contractService.findContract(id)
            : await invoiceService.findInvoice(id);
        const fileId = document.fileId;
        const file = fileId ? await fileService.findById(fileId) : undefined;
        if (!fileId || !file) {
          throw new Error('stored file not found');
        }
        const response = await fetch(
          await fileService.resolvePublicUrlForUploadedFile(fileId),
        );
        if (!response.ok) {
          throw new Error(`stored file returned HTTP ${response.status}`);
        }
        const storedText = pdfText(Buffer.from(await response.arrayBuffer()));

        // Documents with frozen render inputs already carry their own date.
        // Otherwise the PDF was issued at the last signature, or when its file
        // was stored if it was rendered later.
        const frozen = Boolean(
          (document as { renderInputs?: unknown }).renderInputs,
        );
        const lastSignedAt = Math.max(
          ...document.signatures.map((s) => s.signedAt?.getTime() ?? 0),
        );
        const issuedDates = frozen
          ? [undefined]
          : [
              ...new Set([
                berlinDate(new Date(lastSignedAt)),
                berlinDate(file.uploadedAt ?? file.createdAt),
              ]),
            ];
        const body = (document.resolvedBody ??
          document.documentTemplate?.body ??
          {}) as Body;

        let outcome: 'current' | 'replace' | 'review' = 'review';
        let fixedPdf: Buffer | undefined;
        for (const issued of issuedDates) {
          const fieldOverrides = { ...(document.fieldOverrides ?? {}) };
          if (issued) {
            for (const fieldId of generatedDateFieldIds(body)) {
              fieldOverrides[fieldId] ??= issued;
            }
          }
          const fixed = { ...document, fieldOverrides } as Document;
          const legacy = {
            ...fixed,
            signatures: document.signatures.map((signature) => ({
              ...signature,
              signedByName: null,
            })),
          } as Document;

          fixedPdf = await renderer.generatePdf(fixed);
          if (pdfText(fixedPdf) === storedText) {
            outcome = 'current';
            break;
          }
          if (pdfText(await renderer.generatePdf(legacy)) === storedText) {
            outcome = 'replace';
            break;
          }
        }

        if (outcome === 'current') {
          counts.current++;
          continue;
        }
        if (outcome === 'review' || !fixedPdf) {
          counts.review++;
          console.log(`needs review: ${kind} ${id} (file ${fileId})`);
          continue;
        }

        counts.replaced++;
        if (!APPLY) {
          console.log(`would replace: ${kind} ${id} (file ${fileId})`);
          continue;
        }
        if (!file.organizationUnitId || !file.uploadedByUserId) {
          throw new Error('stored file has no unit or uploader');
        }
        const saved = await fileService.saveGeneratedFile({
          organizationUnitId: file.organizationUnitId,
          filename: file.filename,
          mimeType: 'application/pdf',
          bytes: fixedPdf,
          uploadedByUserId: file.uploadedByUserId,
          purpose: FilePurpose.DOCUMENT,
        });
        const table = kind === 'contract' ? schema.contracts : schema.invoices;
        await db
          .update(table)
          .set({ fileId: saved.id })
          .where(and(eq(table.id, id), eq(table.fileId, fileId)));
        console.log(`replaced: ${kind} ${id} (file ${fileId} -> ${saved.id})`);
      } catch (error) {
        counts.failed++;
        console.error(
          `failed: ${kind} ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    console.log(
      `rerender-signer-names: ${counts.replaced} ${APPLY ? 'replaced' : 'to replace'}, ${counts.current} already current, ${counts.review} need review, ${counts.failed} failed`,
    );
  } finally {
    await lock
      .query('select pg_advisory_unlock($1)', [LOCK_KEY])
      .catch(() => undefined);
    lock.release();
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
