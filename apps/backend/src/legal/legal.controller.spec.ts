import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TermsChangeClass } from '../terms/enums';
import { ALLOW_UNACCEPTED_TERMS_KEY } from '../terms/guards/allow-unaccepted-terms.decorator';
import type { TermsService } from '../terms/services/terms.service';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

const controllerWith = (
  current: Awaited<ReturnType<TermsService['getCurrentVersion']>>,
) => {
  const dir = mkdtempSync(join(tmpdir(), 'legal-controller-'));
  writeFileSync(join(dir, 'privacy-policy_2026-08-17_de.pdf'), 'old');
  writeFileSync(join(dir, 'privacy-policy_2026-08-25_de.pdf'), 'new');
  writeFileSync(join(dir, 'privacy-policy_2026-08-25_en.pdf'), 'new-en');

  return new LegalController(new LegalService(dir), {
    getCurrentVersion: async () => current,
  } as unknown as TermsService);
};

describe('LegalController.documents', () => {
  it('summarises the current privacy notice and published terms', async () => {
    const summary = await controllerWith({
      version: '1.0',
      class: TermsChangeClass.MAJOR,
      date: '2026-10-06',
    }).documents();

    expect(summary).toEqual({
      privacyNotice: { lastChangedOn: '2026-08-25' },
      terms: { version: '1.0', lastChangedOn: '2026-10-06' },
    });
  });

  it('returns terms: null when no terms version is published', async () => {
    const summary = await controllerWith(null).documents();

    expect(summary.terms).toBeNull();
  });

  it('is reachable anonymously and by users with unaccepted terms', () => {
    const handler = LegalController.prototype.documents;

    expect(Reflect.getMetadata('PUBLIC', handler)).toBe(true);
    expect(Reflect.getMetadata(ALLOW_UNACCEPTED_TERMS_KEY, handler)).toBe(true);
  });
});
