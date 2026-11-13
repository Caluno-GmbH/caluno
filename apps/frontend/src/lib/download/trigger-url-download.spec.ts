import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { triggerUrlDownload } from './trigger-url-download';

describe('triggerUrlDownload', () => {
  let anchor: {
    href: string;
    download: string;
    click: ReturnType<typeof mock>;
  };
  let origDocument: typeof globalThis.document;
  let origURL: typeof globalThis.URL;
  let revokeObjectUrlSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    anchor = { href: '', download: '', click: mock(() => {}) };
    origDocument = globalThis.document;
    origURL = globalThis.URL;

    // Stub document.createElement to return our fake anchor
    globalThis.document = {
      createElement: mock(() => anchor),
    } as unknown as Document;

    revokeObjectUrlSpy = mock(() => {});
    globalThis.URL = {
      ...globalThis.URL,
      revokeObjectURL: revokeObjectUrlSpy,
    } as unknown as typeof URL;
  });

  afterEach(() => {
    // Restore the originals wholesale; the beforeEach replaces URL with a
    // plain-object spread (not a constructor), so a partial restore would
    // leak a broken global URL into later test files.
    globalThis.document = origDocument;
    globalThis.URL = origURL;
  });

  it('sets href to the provided url', () => {
    triggerUrlDownload('export.csv', 'https://example.com/file.csv?sig=abc');
    expect(anchor.href).toBe('https://example.com/file.csv?sig=abc');
  });

  it('sets download to the provided filename', () => {
    triggerUrlDownload('export.csv', 'https://example.com/file.csv?sig=abc');
    expect(anchor.download).toBe('export.csv');
  });

  it('calls click() on the anchor', () => {
    triggerUrlDownload('export.csv', 'https://example.com/file.csv?sig=abc');
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });

  it('does NOT call URL.revokeObjectURL', () => {
    triggerUrlDownload('export.csv', 'https://example.com/file.csv?sig=abc');
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();
  });
});
