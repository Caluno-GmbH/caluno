import { NotebookPen } from 'lucide-react';

/**
 * Icon registry for EE nav items (`EeExtensions.navItems`). Nav item
 * descriptors carry a name (serializable, safe to pass from a server
 * component to a client component) rather than a component reference;
 * the sidebar resolves it client-side via this map.
 * A new EE nav item reusing an existing icon needs no change here.
 */
export const EE_ICONS = {
  'notebook-pen': NotebookPen,
} as const;

export type EeIconName = keyof typeof EE_ICONS;
