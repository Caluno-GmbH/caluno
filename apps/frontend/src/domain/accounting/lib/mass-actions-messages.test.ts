import { describe, expect, it } from 'bun:test';
import de from '../../../../messages/de.json';
import en from '../../../../messages/en.json';

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

// Cast through unknown so we can access the not-yet-existing key without a
// compile error while also getting a runtime undefined that the test catches.
const reimbursements = (en.Accounting.reimbursements as unknown as Record<string, unknown>);
const reimbursementsDe = (de.Accounting.reimbursements as unknown as Record<string, unknown>);

const enKeys = new Set(leafKeys(reimbursements['massActions']));
const deKeys = new Set(leafKeys(reimbursementsDe['massActions']));

describe('Accounting.reimbursements.massActions i18n parity', () => {
  it('the massActions subtree exists and is non-empty in en', () => {
    expect(enKeys.size).toBeGreaterThan(0);
  });

  it('the massActions subtree exists and is non-empty in de', () => {
    expect(deKeys.size).toBeGreaterThan(0);
  });

  it('every key in en also exists in de', () => {
    const missing = [...enKeys].filter((k) => !deKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('every key in de also exists in en', () => {
    const missing = [...deKeys].filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });
});
