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
        address: 'Hauptstraße 1',
        zipCode: '',
        city: 'Berlin',
      }),
    ).toEqual(['org_zip']);
  });

  it('does not flag org_zip once the org has one', () => {
    expect(
      missingOrgProfileSourcesForOrg(docWithOrgZip, {
        address: 'Hauptstraße 1',
        zipCode: '10115',
        city: 'Berlin',
      }),
    ).toEqual([]);
  });
});
