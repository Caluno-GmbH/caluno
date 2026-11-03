import { beforeEach, describe, expect, it, mock } from 'bun:test';

import {
  createMismatchReporter,
  patchNodePrototype,
  type SentrySink,
} from './translation-dom-guard';

const addBreadcrumb = mock(() => {});
const captureMessage = mock(() => 'event-id');
const sentry = { addBreadcrumb, captureMessage } as unknown as SentrySink;

// Minimal stand-in for the DOM Node API: throws like the browser when the
// node is not a child, so unpatched behaviour is observable.
function createFakeNodeClass() {
  class FakeNode {
    parentNode: FakeNode | null = null;
    childNodes: FakeNode[] = [];

    constructor(readonly nodeName: string) {}

    removeChild(child: FakeNode) {
      if (child.parentNode !== this) throw new Error('NotFoundError');
      this.childNodes.splice(this.childNodes.indexOf(child), 1);
      child.parentNode = null;
      return child;
    }

    insertBefore(newNode: FakeNode, referenceNode: FakeNode | null) {
      if (!referenceNode) return this.appendChild(newNode);
      if (referenceNode.parentNode !== this) throw new Error('NotFoundError');
      newNode.parentNode?.removeChild(newNode);
      this.childNodes.splice(
        this.childNodes.indexOf(referenceNode),
        0,
        newNode,
      );
      newNode.parentNode = this;
      return newNode;
    }

    appendChild(newNode: FakeNode) {
      newNode.parentNode?.removeChild(newNode);
      this.childNodes.push(newNode);
      newNode.parentNode = this;
      return newNode;
    }
  }
  return FakeNode;
}

type FakeNodeClass = ReturnType<typeof createFakeNodeClass>;
type FakeNode = InstanceType<FakeNodeClass>;

function patch(FakeNode: FakeNodeClass) {
  const report = mock(() => {});
  patchNodePrototype(FakeNode.prototype as unknown as Node, report);
  return report;
}

describe('patchNodePrototype', () => {
  let FakeNode: FakeNodeClass;
  let parent: FakeNode;
  let child: FakeNode;

  beforeEach(() => {
    FakeNode = createFakeNodeClass();
    parent = new FakeNode('div');
    child = new FakeNode('#text');
  });

  describe('removeChild', () => {
    it('removes a direct child natively without reporting', () => {
      const report = patch(FakeNode);
      parent.appendChild(child);

      expect(parent.removeChild(child)).toBe(child);
      expect(parent.childNodes).toEqual([]);
      expect(report).not.toHaveBeenCalled();
    });

    it('removes a reparented child from its actual parent', () => {
      const report = patch(FakeNode);
      const font = new FakeNode('font');
      parent.appendChild(font);
      font.appendChild(child);

      expect(parent.removeChild(child)).toBe(child);
      expect(font.childNodes).toEqual([]);
      expect(child.parentNode).toBeNull();
      expect(report).toHaveBeenCalledWith('removeChild', parent, child, font);
    });

    it('returns a detached child without throwing', () => {
      const report = patch(FakeNode);

      expect(parent.removeChild(child)).toBe(child);
      expect(report).toHaveBeenCalledWith('removeChild', parent, child, null);
    });
  });

  describe('insertBefore', () => {
    it('inserts before a direct child natively without reporting', () => {
      const report = patch(FakeNode);
      const reference = new FakeNode('span');
      parent.appendChild(reference);

      expect(parent.insertBefore(child, reference)).toBe(child);
      expect(parent.childNodes).toEqual([child, reference]);
      expect(report).not.toHaveBeenCalled();
    });

    it('appends to the intended parent when the reference was reparented', () => {
      const report = patch(FakeNode);
      const font = new FakeNode('font');
      const reference = new FakeNode('#text');
      font.appendChild(reference);

      expect(parent.insertBefore(child, reference)).toBe(child);
      expect(parent.childNodes).toEqual([child]);
      expect(report).toHaveBeenCalledWith(
        'insertBefore',
        parent,
        reference,
        font,
      );
    });

    it('takes the native path for a null reference node', () => {
      const report = patch(FakeNode);

      expect(parent.insertBefore(child, null)).toBe(child);
      expect(parent.childNodes).toEqual([child]);
      expect(report).not.toHaveBeenCalled();
    });
  });

  it('still recovers when reporting throws', () => {
    patchNodePrototype(FakeNode.prototype as unknown as Node, () => {
      throw new Error('reporting failed');
    });
    const font = new FakeNode('font');
    font.appendChild(child);

    expect(parent.removeChild(child)).toBe(child);
    expect(font.childNodes).toEqual([]);
    expect(parent.insertBefore(child, new FakeNode('span'))).toBe(child);
    expect(parent.childNodes).toEqual([child]);
  });

  it('patches a prototype only once', () => {
    const report = patch(FakeNode);
    patchNodePrototype(FakeNode.prototype as unknown as Node, report);

    parent.removeChild(child);
    expect(report).toHaveBeenCalledTimes(1);
  });
});

describe('createMismatchReporter', () => {
  beforeEach(() => {
    addBreadcrumb.mockClear();
    captureMessage.mockClear();
  });

  function fakeDocument(classes: string[] = []) {
    return {
      documentElement: {
        lang: 'en',
        classList: { contains: (name: string) => classes.includes(name) },
      },
    } as unknown as Document;
  }

  const node = (nodeName: string) => ({ nodeName }) as Node;

  it('adds a breadcrumb per mismatch but captures one message per page', () => {
    const report = createMismatchReporter(
      fakeDocument(['translated-ltr']),
      sentry,
    );

    report('removeChild', node('DIV'), node('#text'), node('FONT'));
    report('insertBefore', node('DIV'), node('#text'), null);

    expect(addBreadcrumb).toHaveBeenCalledTimes(2);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      'DOM mismatch recovered in removeChild (browser translation)',
      {
        level: 'warning',
        tags: { dom_mismatch: 'removeChild', translated: 'true' },
        contexts: {
          dom_mismatch: {
            operation: 'removeChild',
            parent: 'div',
            node: '#text',
            actualParent: 'font',
            htmlLang: 'en',
            translated: true,
          },
        },
      },
    );
  });

  it('does not blame translation when the page is not translated', () => {
    const report = createMismatchReporter(fakeDocument(), sentry);

    report('insertBefore', node('DIV'), node('SPAN'), null);

    expect(captureMessage).toHaveBeenCalledWith(
      'DOM mismatch recovered in insertBefore',
      expect.objectContaining({
        tags: { dom_mismatch: 'insertBefore', translated: 'false' },
      }),
    );
  });
});
