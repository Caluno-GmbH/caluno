import { NotebookPen } from 'lucide-react';

/**
 * Icon registry for EE nav contributions (`EeExtensions.nav`). Nav
 * descriptors carry a name (serializable, safe to pass from a server
 * component to a client component) rather than a component reference;
 * `mergeAdminNav` resolves it via this map.
 * A new EE nav item reusing an existing icon needs no change here.
 */
export const EE_ICONS = {
  'notebook-pen': NotebookPen,
} as const;

export type EeIconName = keyof typeof EE_ICONS;
