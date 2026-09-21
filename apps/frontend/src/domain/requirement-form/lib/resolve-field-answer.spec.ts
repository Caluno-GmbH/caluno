import { describe, expect, it } from 'bun:test';
import {
  isMaskedPaymentAnswer,
  resolveFieldAnswer,
  type SubmissionField,
} from './resolve-field-answer';

const field = (over: Partial<SubmissionField>): SubmissionField => ({
  id: 'f1',
  label: 'Field',
  type: 'TEXT',
  ...over,
});

const opts = {
  dash: '—',
  accepted: 'Accepted',
  formatDate: (d: Date) => `FMT:${d.toISOString().slice(0, 10)}`,
  genderLabels: {
    female: 'Female',
    male: 'Male',
    diverse: 'Diverse',
    'prefer-not-to-say': 'Prefer not to say',
  },
};

describe('resolveFieldAnswer', () => {
  it('prefers profile data over the submission value when a systemKey is set', () => {
    const result = resolveFieldAnswer(
      field({ id: 'f1', systemKey: 'firstName' }),
      [{ fieldId: 'f1', value: 'from-submission' }],
      { firstName: 'from-profile' },
      opts,
    );
    expect(result).toBe('from-profile');
  });

  it('falls back to the submission value when no profile data matches', () => {
    const result = resolveFieldAnswer(
      field({ id: 'f1', type: 'TEXT' }),
      [{ fieldId: 'f1', value: 'hello' }],
      {},
      opts,
    );
    expect(result).toBe('hello');
  });

  it('returns the dash when there is no value at all', () => {
    expect(resolveFieldAnswer(field({ type: 'TEXT' }), [], {}, opts)).toBe('—');
    expect(
      resolveFieldAnswer(
        field({ type: 'TEXT' }),
        [{ fieldId: 'f1', value: '' }],
        {},
        opts,
      ),
    ).toBe('—');
  });

  it('formats DATE fields through formatDate', () => {
    const result = resolveFieldAnswer(
      field({ type: 'DATE' }),
      [{ fieldId: 'f1', value: '2026-08-06' }],
      {},
      opts,
    );
    expect(result).toBe('FMT:2026-08-06');
  });

  it('passes unparseable DATE values through unchanged', () => {
    const result = resolveFieldAnswer(
      field({ type: 'DATE' }),
      [{ fieldId: 'f1', value: 'not-a-date' }],
      {},
      opts,
    );
    expect(result).toBe('not-a-date');
  });

  it('renders CHECKBOX true as accepted and anything else as dash', () => {
    expect(
      resolveFieldAnswer(
        field({ type: 'CHECKBOX' }),
        [{ fieldId: 'f1', value: 'true' }],
        {},
        opts,
      ),
    ).toBe('Accepted');
    expect(
      resolveFieldAnswer(
        field({ type: 'CHECKBOX' }),
        [{ fieldId: 'f1', value: 'false' }],
        {},
        opts,
      ),
    ).toBe('—');
  });

  it('renders DOCUMENT_ACKNOWLEDGEMENT like a checkbox', () => {
    const result = resolveFieldAnswer(
      field({ type: 'DOCUMENT_ACKNOWLEDGEMENT' }),
      [{ fieldId: 'f1', value: 'true' }],
      {},
      opts,
    );
    expect(result).toBe('Accepted');
  });

  it('maps MULTI_CHOICE values to their option labels', () => {
    const result = resolveFieldAnswer(
      field({
        type: 'MULTI_CHOICE',
        options: [
          { label: 'Red', value: 'red' },
          { label: 'Blue', value: 'blue' },
        ],
      }),
      [{ fieldId: 'f1', value: 'red,blue' }],
      {},
      opts,
    );
    expect(result).toBe('Red, Blue');
  });

  it('maps JSON-encoded MULTI_CHOICE values to their option labels', () => {
    const result = resolveFieldAnswer(
      field({
        type: 'MULTI_CHOICE',
        options: [
          { label: 'Red', value: 'red' },
          { label: 'Blue', value: 'blue' },
        ],
      }),
      [{ fieldId: 'f1', value: '["red","blue"]' }],
      {},
      opts,
    );
    expect(result).toBe('Red, Blue');
  });

  it('passes unknown MULTI_CHOICE values through unchanged', () => {
    const result = resolveFieldAnswer(
      field({ type: 'MULTI_CHOICE', options: [] }),
      [{ fieldId: 'f1', value: 'red,mystery' }],
      {},
      opts,
    );
    expect(result).toBe('red, mystery');
  });

  it('renders STATIC_TEXT as the dash', () => {
    const result = resolveFieldAnswer(
      field({ type: 'STATIC_TEXT' }),
      [{ fieldId: 'f1', value: 'anything' }],
      {},
      opts,
    );
    expect(result).toBe('—');
  });

  it('maps gender system values to localized labels', () => {
    const result = resolveFieldAnswer(
      field({ type: 'SINGLE_CHOICE', systemKey: 'gender' }),
      [{ fieldId: 'f1', value: 'female' }],
      {},
      opts,
    );
    expect(result).toBe('Female');
  });

  it('passes unknown gender values through unchanged', () => {
    const result = resolveFieldAnswer(
      field({ type: 'SINGLE_CHOICE', systemKey: 'gender' }),
      [{ fieldId: 'f1', value: 'legacy-free-text' }],
      {},
      opts,
    );
    expect(result).toBe('legacy-free-text');
  });

  it('passes other field types through unchanged', () => {
    const result = resolveFieldAnswer(
      field({ type: 'TEXT' }),
      [{ fieldId: 'f1', value: 'plain text' }],
      {},
      opts,
    );
    expect(result).toBe('plain text');
  });

  it('passes a masked payment value through unchanged so the viewer sees it masked', () => {
    const result = resolveFieldAnswer(
      field({ type: 'IBAN', systemKey: 'iban' }),
      [],
      { iban: 'XXXX XXXX XXXX XXXX XXXX XX' },
      opts,
    );
    expect(result).toBe('XXXX XXXX XXXX XXXX XXXX XX');
  });
});

describe('isMaskedPaymentAnswer', () => {
  it('detects the IBAN mask', () => {
    expect(isMaskedPaymentAnswer('XXXX XXXX XXXX XXXX XXXX XX')).toBe(true);
  });

  it('detects the BIC mask', () => {
    expect(isMaskedPaymentAnswer('XXXXXXXXXXX')).toBe(true);
  });

  it('detects the account holder mask', () => {
    expect(isMaskedPaymentAnswer('XXXXXX XXXXXX')).toBe(true);
  });

  it('does not flag the real payment data a permitted viewer sees', () => {
    expect(isMaskedPaymentAnswer('DE89 3704 0044 0532 0130 00')).toBe(false);
    expect(isMaskedPaymentAnswer('COBADEFFXXX')).toBe(false);
  });

  it('does not flag near-misses', () => {
    expect(isMaskedPaymentAnswer('XXXXXXXX')).toBe(false);
    expect(isMaskedPaymentAnswer('')).toBe(false);
  });
});
