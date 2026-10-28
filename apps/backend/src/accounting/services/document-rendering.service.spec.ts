import { describe, expect, it } from 'bun:test';
import { inflateSync } from 'node:zlib';
import { FilePurpose } from '../../storage/enums';
import type {
  ContractWithRelations,
  InvoiceWithRelations,
} from '../accounting.types';
import { SigneeType } from '../enums';
import {
  DocumentRenderingService,
  letterheadLines,
} from './document-rendering.service';
import type { TemplateBodyShape } from './document-template.types';

interface TimeEntryMock {
  shiftInstance: {
    overrideTitle?: string | null;
    master: { title: string };
  } | null;
  startedAt: Date | null;
  endedAt: Date | null;
  notes?: string | null;
}

/** Inflates the PDF's content streams and decodes their hex TJ strings so assertions can read the rendered text. */
const extractPdfText = (buffer: Buffer): string => {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      content = match[1];
    }
    // pdfkit splits words into kerning-separated hex strings: "[<4272> 10 <616e6368>] TJ".
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
};

/** The text of a rendered PDF; content streams are Flate-compressed and glyph runs hex-encoded. */
const pdfGlyphs = (pdfBytes: Buffer): string => {
  const content = [
    ...pdfBytes.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)endstream/g),
  ]
    .map((m) => inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'))
    .join('\n');
  return [...content.matchAll(/<([0-9a-f]+)>/g)]
    .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
    .join('');
};

describe('DocumentRenderingService', () => {
  let yearlyUsageCallArgs: unknown[] = [];
  let rateCallArgs: unknown[] = [];
  let captured: unknown[] = [];
  let capturedContexts: unknown[] = [];

  const createService = (
    overrides: {
      saveFile?: (args: unknown) => Promise<{ id: string }>;
      rateCents?: number | undefined;
      profileData?: Record<string, unknown>;
      timeEntries?: TimeEntryMock[];
      contract?: {
        resolvedBody?: unknown;
        fieldOverrides?: Record<string, string>;
      };
      unit?: Record<string, unknown>;
      yearlyUsage?: {
        usedCents: number;
        limitCents: number;
        remainingCents: number;
      };
    } = {},
  ) => {
    const db = {
      query: {
        organizations: {
          findFirst: () =>
            Promise.resolve({
              id: 'org-1',
              name: 'Playground',
              street: 'Musterstraße 1',
            }),
        },
        users: {
          findFirst: () => Promise.resolve({ id: 'vol-1' }),
        },
        organizationUnits: {
          findFirst: () =>
            Promise.resolve(overrides.unit ?? { id: 'root-unit' }),
        },
        timeEntries: {
          findMany: () => Promise.resolve(overrides.timeEntries ?? []),
        },
        contracts: {
          findFirst: () => Promise.resolve(overrides.contract),
        },
      },
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as never;
    const userService = {
      getProfileDataByUserId: () =>
        Promise.resolve(
          overrides.profileData ?? {
            firstname: 'Max',
            lastname: 'Mustermann',
            street: 'Testweg 2',
          },
        ),
    } as never;
    const reimbursementRateService = {
      getEffectiveRateCents: (...args: unknown[]) => {
        rateCallArgs = args;
        return Promise.resolve(overrides.rateCents);
      },
      getYearlyUsage: (...args: unknown[]) => {
        yearlyUsageCallArgs = args;
        return Promise.resolve(overrides.yearlyUsage);
      },
    } as never;
    const fileService = {
      saveGeneratedFile: (args: unknown) =>
        overrides.saveFile
          ? overrides.saveFile(args)
          : Promise.resolve({ id: 'file-1' }),
    } as never;
    const organizationService = {
      requireRootUnit: () =>
        Promise.resolve(overrides.unit ?? { id: 'root-unit' }),
    } as never;
    captured = [];
    capturedContexts = [];
    const observabilityService = {
      captureException: (error: unknown, context?: unknown) => {
        captured.push(error);
        capturedContexts.push(context);
      },
    } as never;
    return new DocumentRenderingService(
      db,
      userService,
      reimbursementRateService,
      fileService,
      organizationService,
      observabilityService,
    );
  };

  const contract = (
    overrides: Partial<ContractWithRelations> = {},
  ): ContractWithRelations =>
    ({
      id: 'contract-1',
      volunteerId: 'vol-1',
      reimbursementTypeId: 'type-1',
      reimbursementType: {
        id: 'type-1',
        yearlyLimitCents: 300000,
        platformDefaultRateCents: 1500,
      },
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      totalAmountCents: 20000,
      contractStatus: 'ACTIVE',
      documentTemplate: {
        organizationId: 'org-1',
        organizationUnitId: 'unit-1',
        body: {
          header: {
            titleLines: ['Zusatzvereinbarung'],
            orgIdentityLine: {
              id: 'org-line',
              text: '{org_name} — {org_street}',
              fields: [
                {
                  id: 'org_name',
                  value: { kind: 'bound', source: 'org_name' },
                },
                {
                  id: 'org_street',
                  value: { kind: 'bound', source: 'org_street' },
                },
              ],
            },
          },
          blocks: [
            {
              id: 'block-1',
              title: 'Details',
              lines: [
                {
                  id: 'line-1',
                  text: 'Stundensatz: {hourly_rate}',
                  fields: [
                    {
                      id: 'hourly_rate',
                      value: { kind: 'bound', source: 'hourly_rate' },
                    },
                  ],
                },
              ],
            },
          ],
          footer: {
            closingLine: { id: 'closing', text: 'Vielen Dank', fields: [] },
          },
        },
      },
      signatures: [
        {
          signeeType: 'VOLUNTEER',
          signedAt: new Date('2025-02-01T10:00:00Z'),
        },
        {
          signeeType: 'PERMISSION_HOLDER',
          signedAt: new Date('2025-02-02T10:00:00Z'),
        },
      ],
      ...overrides,
    }) as unknown as ContractWithRelations;

  const invoice = (
    overrides: Partial<InvoiceWithRelations> = {},
  ): InvoiceWithRelations =>
    ({
      id: 'invoice-1',
      volunteerId: 'vol-1',
      reimbursementTypeId: 'type-1',
      reimbursementType: {
        id: 'type-1',
        yearlyLimitCents: 300000,
        platformDefaultRateCents: 1500,
      },
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      totalAmountCents: 8250,
      invoiceStatus: 'OPEN',
      documentTemplate: {
        organizationId: 'org-1',
        organizationUnitId: 'unit-1',
        body: {
          header: { titleLines: ['Stundennachweis'] },
          blocks: [
            {
              id: 'table-1',
              kind: 'table',
              title: 'Stundennachweis',
              columns: [
                'Tätigkeit',
                'Beginn',
                'Ende',
                'Stunden gesamt',
                'Stundensatz',
              ],
            },
          ],
          footer: {},
        },
      },
      invoiceTimeEntries: [{ timeEntryId: 'te-1' }, { timeEntryId: 'te-2' }],
      signatures: [],
      ...overrides,
    }) as unknown as InvoiceWithRelations;

  it('generatePdf produces a valid PDF buffer', async () => {
    const service = createService({ rateCents: 1500 });
    const buffer = await service.generatePdf(contract());
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  // VOLI-1370: an issued document must render from its creation-time snapshot,
  // so a later template edit never rewrites it.
  it('renders the resolvedBody snapshot, not the live template body', async () => {
    const body = (title: string) => ({
      header: {
        titleLines: [title],
        orgIdentityLine: { id: 'org-line', text: '', fields: [] },
        metaLines: [],
      },
      blocks: [],
      footer: { closingLine: { id: 'closing', text: '', fields: [] } },
    });
    const service = createService({ rateCents: 1500 });
    const buffer = await service.generatePdf(
      contract({
        resolvedBody: body('SnapshotTitle'),
        documentTemplate: {
          organizationId: 'org-1',
          organizationUnitId: 'unit-1',
          body: body('LiveTemplateTitle'),
        } as unknown as ContractWithRelations['documentTemplate'],
      }),
    );

    const glyphs = pdfGlyphs(buffer);
    expect(glyphs).toContain('SnapshotTitle');
    expect(glyphs).not.toContain('LiveTemplateTitle');
  });

  it('generatePdf renders an invoice with a valid PDF buffer', async () => {
    const service = createService({
      rateCents: 1500,
      timeEntries: [
        {
          shiftInstance: { master: { title: 'Community Support' } },
          startedAt: new Date('2025-01-10T08:00:00Z'),
          endedAt: new Date('2025-01-10T10:00:00Z'),
          notes: '',
        },
        {
          shiftInstance: { master: { title: 'Food Distribution' } },
          startedAt: new Date('2025-01-11T09:00:00Z'),
          endedAt: new Date('2025-01-11T12:30:00Z'),
          notes: '',
        },
      ],
    });
    const buffer = await service.generatePdf(invoice());
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renderAndAttachPdf saves the file with the document purpose and returns its id', async () => {
    let saved: unknown;
    const service = createService({
      rateCents: 1500,
      saveFile: (args) => {
        saved = args;
        return Promise.resolve({ id: 'file-42' });
      },
    });
    const fileId = await service.renderAndAttachPdf(contract(), 'actor-1');
    expect(fileId).toBe('file-42');
    expect(saved).toMatchObject({
      organizationUnitId: 'unit-1',
      filename: expect.stringMatching(/^Vereinbarung-contract\.pdf$/),
      mimeType: 'application/pdf',
      uploadedByUserId: 'actor-1',
      purpose: FilePurpose.DOCUMENT,
    });
    expect(saved).toHaveProperty('bytes');
  });

  it('renderAndAttachPdf reports a failure to Sentry and returns null', async () => {
    const failure = new Error('storage is down');
    const service = createService({
      rateCents: 1500,
      saveFile: () => Promise.reject(failure),
    });
    const fileId = await service.renderAndAttachPdf(contract(), 'actor-1');
    expect(fileId).toBeNull();
    expect(captured).toEqual([failure]);
  });

  it('renderAndAttachPdf names the step that failed and the document in the report', async () => {
    const service = createService({
      rateCents: 1500,
      saveFile: () => Promise.reject(new Error('S3 timeout')),
    });
    await service.renderAndAttachPdf(
      contract({ documentTemplateId: 'template-1' }),
      'actor-1',
    );
    expect(capturedContexts).toEqual([
      {
        tags: {
          feature: 'document-pdf',
          stage: 'store',
          documentKind: 'contract',
        },
        extra: {
          documentId: 'contract-1',
          documentTemplateId: 'template-1',
          organizationId: 'org-1',
          organizationUnitId: 'unit-1',
          actorUserId: 'actor-1',
        },
      },
    ]);
  });

  it('renderAndAttachPdf reports a failure while generating as the generate step', async () => {
    const service = createService({ rateCents: 1500 });
    await service.renderAndAttachPdf(
      contract({ documentTemplate: null as never }),
      'actor-1',
    );
    expect(capturedContexts).toEqual([
      expect.objectContaining({
        tags: expect.objectContaining({ stage: 'generate' }),
      }),
    ]);
  });

  it('resolves the rate at the document own unit, not the template unit', async () => {
    rateCallArgs = [];
    const service = createService({ rateCents: 1500 });
    await service.generatePdf(
      contract({
        organizationUnitId: 'sub-unit',
        documentTemplate: {
          ...contract().documentTemplate,
          organizationUnitId: null,
        } as never,
      }),
    );
    expect(rateCallArgs).toEqual(['org-1', 'sub-unit', 'type-1']);
  });

  describe('signature seats', () => {
    it('renders from the frozen render inputs, not from the live profile', async () => {
      const service = createService({ rateCents: 1500 });
      const live = extractPdfText(await service.generatePdf(contract()));
      expect(live).toContain('Max Mustermann');

      const frozen = await service.resolveRenderInputs(contract());
      const changed = createService({
        rateCents: 1500,
        profileData: { firstname: 'Erika', lastname: 'Neu', street: 'X' },
      });
      const text = extractPdfText(
        await changed.generatePdf(contract({ renderInputs: frozen })),
      );
      expect(text).toContain('Max Mustermann');
      expect(text).not.toContain('Erika Neu');
    });

    it('resolves the live values while nothing is frozen', async () => {
      const changed = createService({
        rateCents: 1500,
        profileData: { firstname: 'Erika', lastname: 'Neu', street: 'X' },
      });
      const text = extractPdfText(await changed.generatePdf(contract()));
      expect(text).toContain('Erika Neu');
    });

    it('renders name and signing date only for parties that have signed', async () => {
      const service = createService({ rateCents: 1500 });
      const text = extractPdfText(
        await service.generatePdf(
          contract({
            signatures: [
              {
                signeeType: SigneeType.VOLUNTEER,
                signedAt: new Date('2025-02-01T10:00:00Z'),
              },
              { signeeType: SigneeType.PERMISSION_HOLDER, signedAt: null },
            ] as unknown as ContractWithRelations['signatures'],
          }),
        ),
      );
      expect(text).toContain('Unterschrift');
      expect(text).toContain('Max Mustermann');
      expect(text).toContain('01.02.2025 11:00:00');
      expect(text).not.toContain('02.02.2025');
    });

    it('names the person who countersigned in the organisation seat, not the organisation', async () => {
      const service = createService({
        rateCents: 1500,
        unit: { id: 'root-unit', name: 'Bürgerstiftung Musterstadt' },
      });
      const signatures = (signedByName: string | null) =>
        [
          {
            signeeType: SigneeType.VOLUNTEER,
            signedAt: new Date('2025-02-01T10:00:00Z'),
          },
          {
            signeeType: SigneeType.PERMISSION_HOLDER,
            signedAt: new Date('2025-02-02T10:00:00Z'),
            signedByName,
          },
        ] as unknown as ContractWithRelations['signatures'];
      const orgNameHits = (text: string) =>
        [...text.matchAll(/Bürgerstiftung Musterstadt/g)].length;

      const signed = extractPdfText(
        await service.generatePdf(
          contract({ signatures: signatures('Erika Musterfrau') }),
        ),
      );
      const legacy = extractPdfText(
        await service.generatePdf(contract({ signatures: signatures(null) })),
      );

      expect(signed).toContain('Erika Musterfrau');
      expect(orgNameHits(legacy)).toBe(orgNameHits(signed) + 1);
    });

    it('repeats the page footer and numbers every page when enabled', async () => {
      const service = createService({ rateCents: 1500 });
      const base = contract();
      const template = base.documentTemplate;
      const body = template.body as Record<string, unknown>;
      const text = extractPdfText(
        await service.generatePdf({
          ...base,
          documentTemplate: {
            ...template,
            body: {
              ...body,
              blocks: Array.from({ length: 40 }, (_, i) => ({
                id: `filler-${i}`,
                title: `Abschnitt ${i}`,
                lines: [
                  {
                    id: `filler-line-${i}`,
                    text: 'Vorlesestunde.',
                    fields: [],
                  },
                ],
              })),
              pageFooter: {
                enabled: true,
                text: 'BSM gGmbH\nAmtsgericht HH, HRB 12345',
              },
            },
          },
        } as unknown as ContractWithRelations),
      );

      expect(text).toContain('BSM gGmbH');
      expect(text).toContain('Amtsgericht HH, HRB 12345');
      expect(text).toContain('Seite 1 von');
      expect(text).toContain('Seite 2 von');
      const total = text.match(/Seite 1 von (\d+)/)?.[1];
      expect(Number(total)).toBeGreaterThan(1);
      const footerHits = [...text.matchAll(/BSM gGmbH/g)].length;
      expect(footerHits).toBe(Number(total));
    });

    it('does not overflow the page with a wrapping footer', async () => {
      const service = createService({ rateCents: 1500 });
      const base = contract();
      const template = base.documentTemplate;
      const body = template.body as Record<string, unknown>;
      const sample =
        'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium';
      const render = async (footerText: string) =>
        extractPdfText(
          await service.generatePdf({
            ...base,
            documentTemplate: {
              ...template,
              body: {
                ...body,
                pageFooter: { enabled: true, text: footerText },
              },
            },
          } as unknown as ContractWithRelations),
        );
      const pageCount = (text: string) =>
        Number(text.match(/Seite 1 von (\d+)/)?.[1]);

      const oneLine = await render(sample);
      const wrapping = await render(Array(6).fill(sample).join(' '));

      expect(pageCount(wrapping)).toBe(pageCount(oneLine));
      // Cut to three printed lines, the last ending in an ellipsis.
      expect([...wrapping.matchAll(/Lorem ipsum/g)]).toHaveLength(3);
      expect([...oneLine.matchAll(/Lorem ipsum/g)]).toHaveLength(1);
    });

    it('prints three typed lines in full and cuts the fourth', async () => {
      const service = createService({ rateCents: 1500 });
      const base = contract();
      const template = base.documentTemplate;
      const body = template.body as Record<string, unknown>;
      const render = async (footerText: string) =>
        extractPdfText(
          await service.generatePdf({
            ...base,
            documentTemplate: {
              ...template,
              body: {
                ...body,
                pageFooter: { enabled: true, text: footerText },
              },
            },
          } as unknown as ContractWithRelations),
        );

      const three = await render('Zeile1\nZeile2\nZeile3');
      expect(three).toContain('Zeile3');
      expect(three).not.toContain('…');

      const four = await render('Zeile1\nZeile2\nZeile3\nZeile4');
      expect(four).toContain('Zeile3');
      expect(four).not.toContain('Zeile4');
    });

    it('still numbers pages when the footer text is switched off', async () => {
      const service = createService({ rateCents: 1500 });
      const base = contract();
      const template = base.documentTemplate;
      const body = template.body as Record<string, unknown>;
      const text = extractPdfText(
        await service.generatePdf({
          ...base,
          documentTemplate: {
            ...template,
            body: {
              ...body,
              pageFooter: { enabled: false, text: 'BSM gGmbH' },
            },
          },
        } as unknown as ContractWithRelations),
      );

      expect(text).not.toContain('BSM gGmbH');
      expect(text).toContain('Seite 1 von');
    });

    it('leaves signature seats blank while nobody has signed', async () => {
      const service = createService({ rateCents: 1500 });
      const text = extractPdfText(
        await service.generatePdf(contract({ signatures: [] })),
      );
      expect(text).toContain('Unterschrift');
      expect(text).not.toContain('Max Mustermann');
      expect(text).not.toContain('01.02.2025');
    });
  });

  describe('buildFieldValueMap', () => {
    const buildFieldValueMap = (
      service: DocumentRenderingService,
      body: TemplateBodyShape,
      resolved: Record<string, string>,
      overrides: Record<string, string>,
    ): Record<string, string> =>
      (
        service as unknown as {
          buildFieldValueMap: (
            body: TemplateBodyShape,
            resolved: Record<string, string>,
            overrides: Record<string, string>,
          ) => Record<string, string>;
        }
      ).buildFieldValueMap(body, resolved, overrides);

    it('prefers an override over the bound-profile value', () => {
      const service = createService();
      const body: TemplateBodyShape = {
        header: {
          orgIdentityLine: {
            id: 'org-line',
            text: '{volunteer_iban}',
            fields: [
              {
                id: 'volunteer_iban',
                value: { kind: 'bound', source: 'volunteer_iban' },
              },
            ],
          },
        },
      };

      const values = buildFieldValueMap(
        service,
        body,
        { volunteer_iban: 'DE00 1111 2222 3333 4444 55' },
        { volunteer_iban: 'DE00 9999 9999 9999 9999 99' },
      );

      expect(values.volunteer_iban).toBe('DE00 9999 9999 9999 9999 99');
    });

    it('prefers an override over a manual-template value', () => {
      const service = createService();
      const body: TemplateBodyShape = {
        header: {
          orgIdentityLine: {
            id: 'org-line',
            text: '{kostenstelle}',
            fields: [
              {
                id: 'kostenstelle',
                value: { kind: 'manual-template', value: '1000' },
              },
            ],
          },
        },
      };

      const values = buildFieldValueMap(
        service,
        body,
        {},
        { kostenstelle: '2000' },
      );

      expect(values.kostenstelle).toBe('2000');
    });
  });

  describe('resolveInvoiceTableRows', () => {
    const resolveInvoiceTableRows = (
      service: DocumentRenderingService,
      document: InvoiceWithRelations,
    ): Promise<string[][]> =>
      (
        service as unknown as {
          resolveInvoiceTableRows: (
            d: InvoiceWithRelations,
          ) => Promise<string[][]>;
        }
      ).resolveInvoiceTableRows(document);

    it('appends a Betrag amount cell per row (rate × hours)', async () => {
      const service = createService({
        rateCents: 1500,
        timeEntries: [
          {
            shiftInstance: { master: { title: 'Community Support' } },
            startedAt: new Date('2025-01-10T08:00:00Z'),
            endedAt: new Date('2025-01-10T10:00:00Z'),
            notes: '',
          },
          {
            shiftInstance: { master: { title: 'Food Distribution' } },
            startedAt: new Date('2025-01-11T09:00:00Z'),
            endedAt: new Date('2025-01-11T12:30:00Z'),
            notes: '',
          },
        ],
      });

      const rows = await resolveInvoiceTableRows(service, invoice());

      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveLength(6);
      expect(rows[0][5]).toBe('30,00 €');
      expect(rows[1][5]).toBe('52,50 €');
    });

    it('names the shift each row’s hours came from, preferring a renamed occurrence', async () => {
      const service = createService({
        rateCents: 1500,
        timeEntries: [
          {
            shiftInstance: {
              overrideTitle: 'Food Distribution (Weihnachten)',
              master: { title: 'Food Distribution' },
            },
            startedAt: new Date('2025-01-10T08:00:00Z'),
            endedAt: new Date('2025-01-10T10:00:00Z'),
            notes: '',
          },
        ],
      });

      const rows = await resolveInvoiceTableRows(service, invoice());

      expect(rows[0][0]).toBe('Food Distribution (Weihnachten)');
    });

    it('falls back to the agreement’s task description for hours with no shift', async () => {
      const service = createService({
        rateCents: 1500,
        contract: {
          resolvedBody: {
            blocks: [
              {
                id: 'zeitraum-taetigkeit',
                lines: [
                  {
                    id: 'engagement-tasks',
                    text: 'Tätigkeiten: {tasks}',
                    fields: [
                      {
                        id: 'tasks',
                        value: {
                          kind: 'manual-template',
                          value: 'Betreuung in der Tagespflege',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        timeEntries: [
          {
            shiftInstance: null,
            startedAt: new Date('2025-01-10T08:00:00Z'),
            endedAt: new Date('2025-01-10T10:00:00Z'),
            notes: '',
          },
        ],
      });

      const rows = await resolveInvoiceTableRows(service, invoice());

      expect(rows[0][0]).toBe('Betreuung in der Tagespflege');
    });

    it('repeats the coordinator’s own label when the template asks for one', async () => {
      const service = createService({
        rateCents: 1500,
        timeEntries: [
          {
            shiftInstance: { master: { title: 'Food Distribution' } },
            startedAt: new Date('2025-01-10T08:00:00Z'),
            endedAt: new Date('2025-01-10T10:00:00Z'),
            notes: '',
          },
        ],
      });
      const doc = invoice();
      const table = (
        doc.documentTemplate as unknown as {
          body: { blocks: Record<string, unknown>[] };
        }
      ).body.blocks[0];
      table.firstColumnSource = 'custom';
      table.firstColumnCustomLabel = 'Ehrenamtliche Tätigkeit';

      const rows = await resolveInvoiceTableRows(service, doc);

      expect(rows[0][0]).toBe('Ehrenamtliche Tätigkeit');
    });

    it('renders an empty amount cell when there is no rate', async () => {
      const service = createService({
        rateCents: undefined,
        timeEntries: [
          {
            shiftInstance: { master: { title: 'Community Support' } },
            startedAt: new Date('2025-01-10T08:00:00Z'),
            endedAt: new Date('2025-01-10T10:00:00Z'),
            notes: '',
          },
        ],
      });

      const rows = await resolveInvoiceTableRows(service, invoice());

      expect(rows[0]).toHaveLength(6);
      expect(rows[0][5]).toBe('');
    });
  });

  describe('resolveParagraphs', () => {
    const resolveParagraphs = (
      service: DocumentRenderingService,
      lines: unknown[],
      values: Record<string, string>,
    ): string[] =>
      (
        service as unknown as {
          resolveParagraphs: (
            l: unknown[],
            v: Record<string, string>,
          ) => string[];
        }
      ).resolveParagraphs(lines, values);

    const parties = {
      id: 'parties',
      text: 'Zwischen dem {orgName}, {orgCity},',
      fields: [
        { id: 'n', value: { kind: 'bound', source: 'org_name' } },
        { id: 'c', value: { kind: 'bound', source: 'org_city' } },
      ],
    };
    const additional = {
      id: 'parties-additional',
      text: ' {info},',
      inline: true,
      fields: [{ id: 'i', value: { kind: 'manual-template', value: '' } }],
    };
    const volunteer = {
      id: 'volunteer-name',
      text: 'und Anna Muster,',
      fields: [],
    };
    const values = {
      n: 'Lesepaten Nord',
      c: 'Hamburg',
      i: 'vertreten durch H. Meier',
    };

    it('Reads an inline line on from the sentence it belongs to', () => {
      const paragraphs = resolveParagraphs(
        createService(),
        [parties, additional, volunteer],
        values,
      );

      expect(paragraphs).toEqual([
        'Zwischen dem Lesepaten Nord, Hamburg, vertreten durch H. Meier,',
        'und Anna Muster,',
      ]);
    });

    it('Leaves the sentence alone when the inline line is switched off', () => {
      const paragraphs = resolveParagraphs(
        createService(),
        [parties, { ...additional, enabled: false }, volunteer],
        values,
      );

      expect(paragraphs).toEqual([
        'Zwischen dem Lesepaten Nord, Hamburg,',
        'und Anna Muster,',
      ]);
    });

    it('Starts a paragraph of its own when nothing precedes it', () => {
      expect(resolveParagraphs(createService(), [additional], values)).toEqual([
        ' vertreten durch H. Meier,',
      ]);
    });
  });

  describe('invoiceTotalRowCells', () => {
    const invoiceTotalRowCells = (
      service: DocumentRenderingService,
      totalAmountCents: number,
    ): string[][] =>
      (
        service as unknown as {
          invoiceTotalRowCells: (total: number) => string[][];
        }
      ).invoiceTotalRowCells(totalAmountCents);

    it('states the payout as net and gross with the VAT rate between them', () => {
      const cells = invoiceTotalRowCells(createService(), 8250);

      expect(cells).toEqual([
        ['', '', 'Nettobetrag', '', '', '82,50 €'],
        ['', '', 'zzgl. 0 % USt.', '', '', '0,00 €'],
        ['', '', 'Gesamtbetrag (brutto)', '', '', '82,50 €'],
      ]);
    });

    it('states the same figure twice, because a Pauschale carries no VAT', () => {
      const [net, , gross] = invoiceTotalRowCells(createService(), 12_345);

      expect(net?.[5]).toBe(gross?.[5]);
    });
  });

  describe('Jahresdeckel already-received amount', () => {
    const resolveValues = (
      service: DocumentRenderingService,
      document: InvoiceWithRelations,
    ): Promise<Record<string, string>> =>
      (
        service as unknown as {
          resolveValues: (
            d: InvoiceWithRelations,
          ) => Promise<Record<string, string>>;
        }
      ).resolveValues(document);

    it('reports the year-to-date sum, excluding the current invoice by id', async () => {
      yearlyUsageCallArgs = [];
      const service = createService({
        rateCents: 1500,
        yearlyUsage: {
          usedCents: 5_000,
          limitCents: 84_000,
          remainingCents: 79_000,
        },
      });

      const values = await resolveValues(service, invoice());

      // 50,00 € is the mocked usage as is, not minus the invoice's own
      // 82,50 € (which would clamp to 0,00 €): the invoice is excluded by id.
      expect(values.already_received_amount).toBe('50,00 €');
      expect(yearlyUsageCallArgs).toEqual([
        'org-1',
        'vol-1',
        'type-1',
        2025,
        new Date('2025-01-31'),
        'invoice-1',
      ]);
    });
  });

  describe('resolved org profile values', () => {
    const resolveValues = (
      service: DocumentRenderingService,
      document: ContractWithRelations,
    ): Promise<Record<string, string>> =>
      (
        service as unknown as {
          resolveValues: (
            d: ContractWithRelations,
          ) => Promise<Record<string, string>>;
        }
      ).resolveValues(document);

    it('renders the resolved org postal code the create gate checked', async () => {
      const service = createService({
        unit: {
          id: 'unit-1',
          name: 'Branch',
          street: 'Hauptstraße 1',
          city: 'Berlin',
          zipCode: '10115',
          legalRep: 'Erika Mustermann',
        },
      });

      const values = await resolveValues(service, contract());

      expect(values.org_zip).toBe('10115');
    });

    it('renders a blank postal code as an empty string when the org has none', async () => {
      const service = createService({
        unit: { id: 'unit-1', name: 'Branch' },
      });

      const values = await resolveValues(service, contract());

      expect(values.org_zip).toBe('');
    });
  });

  describe('letterheadLines', () => {
    it('renders the org letterhead above the title in the PDF', async () => {
      const service = createService({
        unit: {
          id: 'unit-1',
          name: 'Branch',
          street: 'Hauptstrasse 1',
          city: 'Berlin',
          zipCode: '10115',
        },
      });
      // New-preset body shape: no header.orgIdentityLine, and org data bound on
      // block lines whose field ids differ from their sources.
      const document = contract({
        documentTemplate: {
          organizationId: 'org-1',
          organizationUnitId: 'unit-1',
          body: {
            header: { titleLines: ['Zusatzvereinbarung'] },
            blocks: [],
            footer: {
              closingLine: { id: 'closing', text: 'Vielen Dank', fields: [] },
            },
          },
        },
      } as never);

      const text = extractPdfText(await service.generatePdf(document));

      expect(text).toContain('Branch');
      expect(text).toContain('Hauptstrasse 1');
      expect(text).toContain('10115 Berlin');
    });

    it('composes name, address, and zip+city lines', () => {
      expect(
        letterheadLines({
          org_name: 'Altonaer Lesepaten',
          org_street: 'Adress eintrag 1',
          org_zip: '22245',
          org_city: 'Berlin',
        }),
      ).toEqual(['Altonaer Lesepaten', 'Adress eintrag 1', '22245 Berlin']);
    });

    it('skips blank org values line-wise', () => {
      expect(
        letterheadLines({
          org_name: 'Verein',
          org_street: '   ',
          org_zip: '',
          org_city: '',
        }),
      ).toEqual(['Verein']);
    });
  });
});
