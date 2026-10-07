import { afterEach, describe, expect, it, mock } from 'bun:test';
import { TermsAutoPublishService } from './terms-auto-publish.service';
import type { TermsPublishService } from './terms-publish.service';

const originalFlag = process.env.TERMS_AUTO_PUBLISH;

function restoreFlag(): void {
  if (originalFlag === undefined) {
    delete process.env.TERMS_AUTO_PUBLISH;
  } else {
    process.env.TERMS_AUTO_PUBLISH = originalFlag;
  }
}

function serviceWith(publishPendingVersions: () => Promise<unknown>) {
  return new TermsAutoPublishService({
    publishPendingVersions,
  } as unknown as TermsPublishService);
}

describe('TermsAutoPublishService', () => {
  afterEach(restoreFlag);

  it('does nothing when TERMS_AUTO_PUBLISH is not "true"', async () => {
    process.env.TERMS_AUTO_PUBLISH = 'false';
    const publishPendingVersions = mock(async () => ({
      published: [],
      notified: [],
    }));

    await serviceWith(publishPendingVersions).runIfEnabled();

    expect(publishPendingVersions).not.toHaveBeenCalled();
  });

  it('publishes pending versions when enabled', async () => {
    process.env.TERMS_AUTO_PUBLISH = 'true';
    const publishPendingVersions = mock(async () => ({
      published: [{ version: '1.0', class: 'MAJOR' }],
      notified: [],
    }));

    await serviceWith(publishPendingVersions).runIfEnabled();

    expect(publishPendingVersions).toHaveBeenCalledTimes(1);
  });

  it('swallows publish failures so the server keeps running', async () => {
    process.env.TERMS_AUTO_PUBLISH = 'true';
    const publishPendingVersions = mock(async () => {
      throw new Error('boom');
    });

    await expect(
      serviceWith(publishPendingVersions).runIfEnabled(),
    ).resolves.toBeUndefined();
  });
});
