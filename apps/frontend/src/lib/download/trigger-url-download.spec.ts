import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { triggerUrlDownload } from './trigger-url-download';

describe('triggerUrlDownload', () => {
  let anchor: {
    href: string;
    download: string;
    click: ReturnType<typeof mock>;
  };
  let origCreateElement: typeof document.createElement;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let revokeObjectUrlSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    anchor = { href: '', download: '', click: mock(() => {}) };
    origCreateElement = globalThis.document?.createElement?.bind(
      globalThis.document,
    );
    origRevokeObjectURL = globalThis.URL?.revokeObjectURL;

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
    if (origCreateElement) {
      (
        globalThis.document as unknown as { createElement: unknown }
      ).createElement = origCreateElement;
    }
    if (origRevokeObjectURL) {
      URL.revokeObjectURL = origRevokeObjectURL;
    }
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
