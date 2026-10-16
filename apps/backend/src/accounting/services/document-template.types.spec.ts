import { describe, expect, it } from 'bun:test';
import {
  findManualFieldValue,
  type TemplateBodyShape,
  withManualFieldValue,
} from './document-template.types';

const body = (): TemplateBodyShape => ({
  header: {
    titleLines: ['Vereinbarung'],
    metaLines: [
      {
        id: 'meta',
        text: 'Laufzeit {lifespan}',
        fields: [
          {
            id: 'contract-lifespan',
            value: { kind: 'manual-template', value: '10/2026' },
          },
        ],
      },
    ],
  },
  blocks: [
    {
      id: 'terms',
      lines: [
        {
          id: 'term',
          text: 'Gültig {lifespan}, Name {name}',
          fields: [
            {
              id: 'contract-lifespan',
              value: { kind: 'manual-template', value: '10/2026' },
            },
            {
              id: 'name',
              value: { kind: 'bound', source: 'volunteer_first_name' },
            },
          ],
        },
      ],
    },
  ],
  footer: {},
});

describe('withManualFieldValue', () => {
  it('sets every occurrence of the manual field', () => {
    const next = withManualFieldValue(body(), 'contract-lifespan', '2026');
    expect(next.header?.metaLines?.[0]?.fields[0]?.value).toEqual({
      kind: 'manual-template',
      value: '2026',
    });
    expect(findManualFieldValue(next, 'contract-lifespan')).toBe('2026');
    expect(next.blocks?.[0]?.lines?.[0]?.fields[0]?.value).toEqual({
      kind: 'manual-template',
      value: '2026',
    });
  });

  it('leaves the input and bound fields untouched', () => {
    const original = body();
    const next = withManualFieldValue(original, 'contract-lifespan', '2026');
    expect(findManualFieldValue(original, 'contract-lifespan')).toBe('10/2026');
    expect(next.blocks?.[0]?.lines?.[0]?.fields[1]?.value).toEqual({
      kind: 'bound',
      source: 'volunteer_first_name',
    });
  });

  it('is a no-op copy when the body has no such field', () => {
    const empty: TemplateBodyShape = { header: {}, blocks: [], footer: {} };
    expect(withManualFieldValue(empty, 'contract-lifespan', '2026')).toEqual(
      empty,
    );
  });
});
