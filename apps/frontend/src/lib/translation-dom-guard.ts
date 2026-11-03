import * as Sentry from '@sentry/nextjs';

/**
 * Browser translators (e.g. Chrome Translate) replace React-owned text nodes
 * with <font> wrappers. When React later removes or inserts relative to those
 * nodes, the native DOM APIs throw NotFoundError and crash the commit
 * (see CALUNO-FRONTEND-16, React issue #11538).
 *
 * We support only a few locales, so we keep translation enabled and instead
 * make removeChild/insertBefore tolerant of nodes that were moved away from
 * their expected parent. Every mismatch is still reported to Sentry.
 */

type Operation = 'removeChild' | 'insertBefore';

export type MismatchReporter = (
  operation: Operation,
  parent: Node,
  node: Node | null,
  actualParent: Node | null,
) => void;

const PATCHED = Symbol.for('caluno.translationDomGuard');

function describeNode(node: Node | null | undefined): string {
  if (!node) return String(node);
  return node.nodeName.toLowerCase();
}

export type SentrySink = Pick<
  typeof Sentry,
  'addBreadcrumb' | 'captureMessage'
>;

export function createMismatchReporter(
  doc: Document,
  sentry: SentrySink = Sentry,
): MismatchReporter {
  let reportedThisPage = false;

  return (operation, parent, node, actualParent) => {
    const data = {
      operation,
      parent: describeNode(parent),
      node: describeNode(node),
      actualParent: describeNode(actualParent),
      htmlLang: doc.documentElement.lang,
      translated:
        doc.documentElement.classList.contains('translated-ltr') ||
        doc.documentElement.classList.contains('translated-rtl'),
    };

    sentry.addBreadcrumb({
      category: 'dom.mismatch',
      level: 'warning',
      message: `${operation}: node is not a child of this node (recovered)`,
      data,
    });

    // Report once per page load to keep visibility without flooding.
    if (!reportedThisPage) {
      reportedThisPage = true;
      sentry.captureMessage(
        `DOM mismatch recovered in ${operation} (likely browser translation)`,
        { level: 'warning', tags: { dom_mismatch: operation }, extra: data },
      );
    }
  };
}

export function patchNodePrototype(proto: Node, report: MismatchReporter) {
  const marked = proto as Node & { [PATCHED]?: true };
  if (marked[PATCHED]) return;
  marked[PATCHED] = true;

  const originalRemoveChild = proto.removeChild;
  proto.removeChild = function removeChild<T extends Node>(
    this: Node,
    child: T,
  ): T {
    if (child.parentNode !== this) {
      const actualParent = child.parentNode;
      report('removeChild', this, child, actualParent);
      if (actualParent) {
        originalRemoveChild.call(actualParent, child);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = proto.insertBefore;
  proto.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      report('insertBefore', this, referenceNode, referenceNode.parentNode);
      return this.appendChild(newNode);
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

export function installTranslationDomGuard() {
  if (typeof window === 'undefined' || typeof Node === 'undefined') return;
  patchNodePrototype(Node.prototype, createMismatchReporter(document));
}
