import { describe, expect, it } from 'bun:test';
import {
  getContractDocument,
  getInvoiceDocument,
} from '../components/template/builder-document-presets';
import { deriveEditableFields } from './creation-fields';

// VOLI-1544: the contract preset's payout-bic line is opt-in, so tests that
// need BIC derived flip the line on — what a coordinator enabling it does.
function contractWithBicEnabled() {
  const doc = getContractDocument('ehrenamt');
  for (const block of doc.blocks) {
    if (block.kind !== 'text') continue;
    for (const line of block.lines) {
      if (line.id === 'payout-bic') line.enabled = true;
    }
  }
  return doc;
}

describe('deriveEditableFields', () => {
  it('returns the template-bound volunteer + manual fields, no hardcoded extras', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'));
    const ids = fields.map((f) => f.fieldId);
    const sources = fields.map((f) => f.source);

    // IBAN and account holder are bound in the default contract preset (payout
    // lines); BIC is an opt-in line (VOLI-1544) and only derives once a
    // coordinator enables it.
    expect(sources).toContain('volunteer_iban');
    expect(sources).toContain('volunteer_account_holder');
    expect(sources).not.toContain('volunteer_bic');

    // Manual-template fields are derived, not hardcoded.
    expect(ids).toContain('contract-lifespan');
    expect(ids).toContain('hours-amount');

    expect(ids).toContain('volunteer-street-field');
    expect(ids).toContain('volunteer-zip-field');
    expect(ids).toContain('volunteer-city-field');

    // No invented ids that aren't bound by the template (e.g. a bare `dob`
    // key, or the disabled optional address/dob/freeform lines).
    expect(ids).not.toContain('dob');
    expect(ids).not.toContain('volunteer-dob-field');
    expect(ids).not.toContain('freeform-text');
  });

  it('prefills a manual-template field from its stored value (provenance template)', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'));
    const hoursUnit = fields.find((f) => f.fieldId === 'hours-unit');
    expect(hoursUnit?.kind).toBe('manual');
    expect(hoursUnit?.value).toBe('Monat');
    expect(hoursUnit?.provenance).toBe('template');
  });

  it('marks a bound field with a profile value provenance profile', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'), {
      iban: 'DE00 1234 5678 9000 0000 00',
    });
    const iban = fields.find((f) => f.source === 'volunteer_iban');
    expect(iban?.kind).toBe('bound');
    expect(iban?.value).toBe('DE00 1234 5678 9000 0000 00');
    expect(iban?.provenance).toBe('profile');
  });

  it('marks a bound field missing from the profile provenance gap', () => {
    const fields = deriveEditableFields(contractWithBicEnabled(), {});
    const bic = fields.find((f) => f.source === 'volunteer_bic');
    expect(bic?.provenance).toBe('gap');
    expect(bic?.value).toBeNull();
  });

  // VOLI-1544: the payout-bic line is optional and off by default, so BIC is
  // not derived from the untouched preset; enabling the line derives it.
  it('derives BIC once the coordinator enables the payout-bic line', () => {
    const fields = deriveEditableFields(contractWithBicEnabled(), {
      bic: 'GENODEM1GLS',
    });
    const bic = fields.find((f) => f.source === 'volunteer_bic');
    expect(bic?.kind).toBe('bound');
    expect(bic?.value).toBe('GENODEM1GLS');
    expect(bic?.provenance).toBe('profile');
  });

  it('omits BIC from the untouched preset', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'));
    expect(fields.map((f) => f.source)).not.toContain('volunteer_bic');
  });

  it('dedupes manual field ids (first occurrence wins)', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'));
    const ids = fields.map((f) => f.fieldId);
    expect(ids.filter((id) => id === 'contract-lifespan')).toHaveLength(1);
  });

  // VOLI-1370: the per-contract modal must render a period picker for the
  // Zeitraum field, which it can only do if the template's `control` survives.
  it('carries the manual field control (period) through to the modal', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'));
    const lifespan = fields.find((f) => f.fieldId === 'contract-lifespan');
    expect(lifespan?.kind).toBe('manual');
    expect(lifespan?.control).toBe('period');

    const hoursUnit = fields.find((f) => f.fieldId === 'hours-unit');
    expect(hoursUnit?.control).toBe('unit-tabs');
  });

  it('carries every field id bound to a source, not just the first', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'));
    const firstName = fields.find((f) => f.source === 'volunteer_first_name');
    expect(firstName?.fieldIds).toEqual(['volunteer-name-first']);
    const lastName = fields.find((f) => f.source === 'volunteer_last_name');
    expect(lastName?.fieldIds).toEqual(['volunteer-name-last']);
    expect(firstName?.fieldId).toBe('volunteer-name-first');
  });

  it('prefills the account holder from the profile like the other payout fields', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'), {
      'account-holder': 'Erika Musterfrau',
    });
    const holder = fields.find((f) => f.source === 'volunteer_account_holder');
    expect(holder?.kind).toBe('bound');
    expect(holder?.value).toBe('Erika Musterfrau');
    expect(holder?.provenance).toBe('profile');
  });

  it('use firstname and lastname from profile and not volunteer name', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'), {
      firstname: 'Anna',
      lastname: 'Müller',
    });
    const first = fields.find((f) => f.source === 'volunteer_first_name');
    const last = fields.find((f) => f.source === 'volunteer_last_name');
    expect(first?.value).toBe('Anna');
    expect(last?.value).toBe('Müller');
  });

  it('marks name sources gap when no volunteer name is supplied', () => {
    const fields = deriveEditableFields(getContractDocument('ehrenamt'), {});
    const streetField = fields.find((f) => f.source === 'volunteer_street');
    expect(streetField?.provenance).toBe('gap');
    expect(streetField?.value).toBeNull();
  });

  it('excludes org/rate/generation-time sources (not per-document editable)', () => {
    const fields = deriveEditableFields(getInvoiceDocument('ehrenamt'));
    const sources = fields.map((f) => f.source);
    expect(sources).not.toContain('org_name');
    expect(sources).not.toContain('org_street');
    expect(sources).not.toContain('org_city');
    expect(sources).not.toContain('generated_date');
    expect(sources).not.toContain('document_number');
    expect(sources).not.toContain('hourly_rate');
  });

  it('derives the invoice volunteer fields from the invoice template', () => {
    const fields = deriveEditableFields(getInvoiceDocument('ehrenamt'));
    const sources = fields.map((f) => f.source);
    expect(sources).toContain('volunteer_first_name');
    expect(sources).toContain('volunteer_last_name');
    expect(sources).toContain('volunteer_street');
    expect(sources).toContain('volunteer_zip');
    expect(sources).toContain('volunteer_city');
    expect(sources).toContain('volunteer_iban');
  });
});
