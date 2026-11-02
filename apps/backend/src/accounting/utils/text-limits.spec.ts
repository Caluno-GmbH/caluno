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

  it('does not limit freeform text', () => {
    expect(() =>
      assertFieldOverrideLengths([
        { fieldId: 'freeform-text', value: 'x'.repeat(5000) },
      ]),
    ).not.toThrow();
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

  it('does not limit a freeform-text manual field', () => {
    expect(() =>
      assertManualFieldLengthsInBody(
        bodyWithField('freeform-text', 'x'.repeat(5000)),
      ),
    ).not.toThrow();
  });

  it('checks fields in header, note blocks and footer too', () => {
    const long = 'x'.repeat(301);
    const field = {
      id: 'tasks',
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

  it('ignores over-limit text in a disabled block', () => {
    const body = bodyWithField('tasks', 'x'.repeat(301));
    expect(() =>
      assertManualFieldLengthsInBody({
        blocks: [{ ...body.blocks[0], enabled: false }],
      }),
    ).not.toThrow();
  });

  it('ignores over-limit text in a disabled line', () => {
    const body = bodyWithField('tasks', 'x'.repeat(301));
    const line = body.blocks[0]?.lines[0];
    expect(() =>
      assertManualFieldLengthsInBody({
        blocks: [{ id: 'b1', lines: [{ ...line, enabled: false }] }],
      }),
    ).not.toThrow();
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
