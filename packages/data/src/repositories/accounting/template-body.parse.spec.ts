import { describe, expect, it } from 'bun:test';
import { parseTemplateBody } from './template-body.types';

describe('parseTemplateBody', () => {
  it('defaults a missing closingLine to an empty TemplateLine', () => {
    const doc = parseTemplateBody({ footer: {} });
    expect(doc.footer.closingLine).toEqual({
      id: 'closing',
      text: '',
      fields: [],
      optional: false,
      enabled: true,
    });
  });

  it('fills fields on a partial closingLine so .fields is always an array', () => {
    const doc = parseTemplateBody({
      footer: {
        closingLine: { id: 'closing', text: '{place}, {date}' },
      },
    });
    expect(doc.footer.closingLine).toEqual({
      id: 'closing',
      text: '{place}, {date}',
      fields: [],
      optional: false,
      enabled: true,
    });
  });

  it('keeps an already-complete closingLine intact', () => {
    const closingLine = {
      id: 'closing',
      text: '{place}, {date}',
      fields: [
        {
          id: 'closing-place',
          value: { kind: 'bound' as const, source: 'org_city' as const },
        },
      ],
      optional: false,
      enabled: true,
    };
    const doc = parseTemplateBody({ footer: { closingLine } });
    expect(doc.footer.closingLine).toEqual(closingLine);
  });
});
