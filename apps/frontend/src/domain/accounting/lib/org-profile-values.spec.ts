import { describe, expect, it } from 'bun:test';
import { getKnownOrgValues } from '../components/template/builder-document-presets';
import {
  missingOrgProfileSourcesForOrg,
  type TemplateDocument,
} from '../components/template/builder-types';

describe('getKnownOrgValues', () => {
  it('exposes the org postal code as a known source', () => {
    const values = getKnownOrgValues({
      pauschale: 'ehrenamt',
      orgZip: '10115',
    });

    expect(values.org_zip).toBe('10115');
  });

  it('omits the postal code when the org has none', () => {
    const values = getKnownOrgValues({ pauschale: 'ehrenamt', orgZip: '' });

    expect(values.org_zip).toBeUndefined();
  });
});

describe('missingOrgProfileSourcesForOrg', () => {
  const docWithOrgZip: TemplateDocument = {
    header: {
      titleLines: [],
      orgIdentityLine: {
        id: 'org-line',
        text: '{orgZip}',
        fields: [
          { id: 'org-zip', value: { kind: 'bound', source: 'org_zip' } },
        ],
        optional: false,
        enabled: true,
      },
      metaLines: [],
    },
    blocks: [],
    footer: {
      closingLine: {
        id: 'closing',
        text: '',
        fields: [],
        optional: false,
        enabled: true,
      },
      showSignatures: true,
    },
  };

  it('flags org_zip when the org has no postal code', () => {
    expect(
      missingOrgProfileSourcesForOrg(docWithOrgZip, {
        street: 'Hauptstraße 1',
        zipCode: '',
        city: 'Berlin',
      }),
    ).toEqual(['org_zip']);
  });

  it('stops asking the org for a detail the template states itself', () => {
    // The gate exists to stop a document going out with a gap where an org
    // value should be. A template that states the value by hand has no gap.
    expect(
      missingOrgProfileSourcesForOrg(
        { ...docWithOrgZip, orgOverrides: { org_zip: '22765' } },
        { street: 'Hauptstraße 1', zipCode: '', city: 'Berlin' },
      ),
    ).toEqual([]);
  });

  it('asks again once the override is cleared', () => {
    // Clearing the field is how an override is undone, so the org has to
    // supply the value again.
    expect(
      missingOrgProfileSourcesForOrg(
        { ...docWithOrgZip, orgOverrides: { org_zip: '   ' } },
        { street: 'Hauptstraße 1', zipCode: '', city: 'Berlin' },
      ),
    ).toEqual(['org_zip']);
  });

  it('does not flag org_zip once the org has one', () => {
    expect(
      missingOrgProfileSourcesForOrg(docWithOrgZip, {
        street: 'Hauptstraße 1',
        zipCode: '10115',
        city: 'Berlin',
      }),
    ).toEqual([]);
  });
});
