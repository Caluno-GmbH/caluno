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

let installed = false;
let reportedThisPage = false;

function describeNode(node: Node | null | undefined): string {
  if (!node) return String(node);
  if (node instanceof Element) return node.tagName.toLowerCase();
  return node.nodeName;
}

function reportMismatch(
  operation: 'removeChild' | 'insertBefore',
  parent: Node,
  node: Node | null,
  actualParent: Node | null,
) {
  const data = {
    operation,
    parent: describeNode(parent),
    node: describeNode(node),
    actualParent: describeNode(actualParent),
    htmlLang: document.documentElement.lang,
    translated:
      document.documentElement.classList.contains('translated-ltr') ||
      document.documentElement.classList.contains('translated-rtl'),
  };

  Sentry.addBreadcrumb({
    category: 'dom.mismatch',
    level: 'warning',
    message: `${operation}: node is not a child of this node (recovered)`,
    data,
  });

  // Report once per page load to keep visibility without flooding.
  if (!reportedThisPage) {
    reportedThisPage = true;
    Sentry.captureMessage(
      `DOM mismatch recovered in ${operation} (likely browser translation)`,
      { level: 'warning', tags: { dom_mismatch: operation }, extra: data },
    );
  }
}

export function installTranslationDomGuard() {
  if (
    installed ||
    typeof window === 'undefined' ||
    typeof Node === 'undefined'
  ) {
    return;
  }
  installed = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild<T extends Node>(
    this: Node,
    child: T,
  ): T {
    if (child.parentNode !== this) {
      const actualParent = child.parentNode;
      reportMismatch('removeChild', this, child, actualParent);
      if (actualParent) {
        originalRemoveChild.call(actualParent, child);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      reportMismatch(
        'insertBefore',
        this,
        referenceNode,
        referenceNode.parentNode,
      );
      return this.appendChild(newNode);
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
