import { describe, expect, it } from 'bun:test';
import { resolveFirstColumn } from './invoice-table';

const row = {
  source: 'shift_name',
  customLabel: 'Sonstige Tätigkeit',
  shiftName: 'Sonntagsdienst',
  agreementTaskDescription: 'Betreuung in der Tagespflege',
  notes: 'Vertretung',
};

describe('resolveFirstColumn', () => {
  it('Names the shift the row’s hours came from', () => {
    expect(resolveFirstColumn(row)).toBe('Sonntagsdienst');
  });

  it('Falls back to the agreement when the hours had no shift', () => {
    expect(resolveFirstColumn({ ...row, shiftName: undefined })).toBe(
      'Betreuung in der Tagespflege',
    );
  });

  it('Falls back to what the volunteer typed when there is no agreement text', () => {
    expect(
      resolveFirstColumn({
        ...row,
        shiftName: undefined,
        agreementTaskDescription: '',
      }),
    ).toBe('Vertretung');
  });

  it('Leaves the cell empty rather than inventing a description', () => {
    expect(
      resolveFirstColumn({
        source: 'shift_name',
        customLabel: undefined,
        shiftName: undefined,
        agreementTaskDescription: undefined,
        notes: undefined,
      }),
    ).toBe('');
  });

  it('Repeats the agreement text down the table when that is the chosen source', () => {
    expect(
      resolveFirstColumn({ ...row, source: 'agreement_task_description' }),
    ).toBe('Betreuung in der Tagespflege');
  });

  it('Ignores the shift name entirely under a custom label', () => {
    expect(resolveFirstColumn({ ...row, source: 'custom' })).toBe(
      'Sonstige Tätigkeit',
    );
  });

  it('Treats a template that names no source as naming the shift', () => {
    expect(resolveFirstColumn({ ...row, source: '' })).toBe('Sonntagsdienst');
  });
});
