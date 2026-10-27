import { describe, expect, it } from 'bun:test';
import { BadRequestGraphQLError } from '../../graphql/errors/bad-request.error';
import {
  assertFieldOverrideLengths,
  assertManualFieldLengthsInBody,
} from './text-limits';

const bodyWithField = (id: string, value: string) => ({
  blocks: [
    {
      id: 'b1',
      lines: [
        {
          id: 'l1',
          text: '{{0}}',
          fields: [{ id, value: { kind: 'manual-template', value } }],
        },
      ],
    },
  ],
});

describe('assertFieldOverrideLengths', () => {
  it('rejects a task description over 300 characters', () => {
    expect(() =>
      assertFieldOverrideLengths([
        { fieldId: 'tasks', value: 'x'.repeat(301) },
      ]),
    ).toThrow(BadRequestGraphQLError);
    expect(() =>
      assertFieldOverrideLengths([
        { fieldId: 'tasks', value: 'x'.repeat(301) },
      ]),
    ).toThrow('Task description must be at most 300 characters');
  });

  it('accepts a task description of exactly 300 characters', () => {
    expect(() =>
      assertFieldOverrideLengths([
        { fieldId: 'tasks', value: 'x'.repeat(300) },
      ]),
    ).not.toThrow();
  });

  it('rejects freeform text over 1000 characters', () => {
    expect(() =>
      assertFieldOverrideLengths([
        { fieldId: 'freeform-text', value: 'x'.repeat(1001) },
      ]),
    ).toThrow('Freeform text must be at most 1000 characters');
  });

  it('does not limit unrelated field ids', () => {
    expect(() =>
      assertFieldOverrideLengths([
        { fieldId: 'something-else', value: 'x'.repeat(5000) },
        { fieldId: 'constructor', value: 'x'.repeat(5000) },
      ]),
    ).not.toThrow();
  });

  it('accepts null and undefined overrides', () => {
    expect(() => assertFieldOverrideLengths(null)).not.toThrow();
    expect(() => assertFieldOverrideLengths(undefined)).not.toThrow();
  });
});

describe('assertManualFieldLengthsInBody', () => {
  it('rejects a tasks manual field over 300 characters', () => {
    expect(() =>
      assertManualFieldLengthsInBody(bodyWithField('tasks', 'x'.repeat(301))),
    ).toThrow('Task description must be at most 300 characters');
  });

  it('accepts a tasks manual field of 300 characters', () => {
    expect(() =>
      assertManualFieldLengthsInBody(bodyWithField('tasks', 'x'.repeat(300))),
    ).not.toThrow();
  });

  it('rejects a freeform-text manual field over 1000 characters', () => {
    expect(() =>
      assertManualFieldLengthsInBody(
        bodyWithField('freeform-text', 'x'.repeat(1001)),
      ),
    ).toThrow('Freeform text must be at most 1000 characters');
  });

  it('checks fields in header, note blocks and footer too', () => {
    const long = 'x'.repeat(1001);
    const field = {
      id: 'freeform-text',
      value: { kind: 'manual-template', value: long },
    };
    const line = { id: 'l', text: '{{0}}', fields: [field] };
    expect(() =>
      assertManualFieldLengthsInBody({ header: { metaLines: [line] } }),
    ).toThrow(BadRequestGraphQLError);
    expect(() =>
      assertManualFieldLengthsInBody({ blocks: [{ id: 'n', line }] }),
    ).toThrow(BadRequestGraphQLError);
    expect(() =>
      assertManualFieldLengthsInBody({ footer: { closingLine: line } }),
    ).toThrow(BadRequestGraphQLError);
  });

  it('ignores bound fields and unrelated manual fields', () => {
    expect(() =>
      assertManualFieldLengthsInBody({
        blocks: [
          {
            id: 'b',
            lines: [
              {
                id: 'l',
                text: '',
                fields: [
                  { id: 'tasks', value: { kind: 'bound', source: 'org_name' } },
                  {
                    id: 'other',
                    value: { kind: 'manual-template', value: 'x'.repeat(5000) },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).not.toThrow();
  });

  it('tolerates malformed bodies', () => {
    expect(() => assertManualFieldLengthsInBody(null)).not.toThrow();
    expect(() => assertManualFieldLengthsInBody('x')).not.toThrow();
    expect(() => assertManualFieldLengthsInBody({ blocks: 'x' })).not.toThrow();
  });
});
