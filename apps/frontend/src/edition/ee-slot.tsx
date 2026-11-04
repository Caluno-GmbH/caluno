import type { ComponentType } from 'react';
import { loadEeExtensions } from './load-ee-extensions';

/** Resolves a named EE UI slot, or `undefined` when EE/the slot is absent. */
export async function resolveEeSlotComponent(
  name: string,
): Promise<ComponentType | undefined> {
  const extensions = await loadEeExtensions();
  const slot = extensions?.slots?.[name];
  if (!slot) {
    return undefined;
  }
  return slot();
}

/**
 * Renders a named EE UI slot inline, or nothing when EE/the slot is absent.
 * Replaces one-off slot components (e.g. the former `ProfileNoteSlot`) —
 * a new EE slot needs only an entry in `src/ee/index.ts`'s `slots` map
 * plus `<EeSlot name="..." />` at the call site, no new OSS file.
 * For full App Router pages that should 404 without EE, use `<EePage />`.
 */
export async function EeSlot({ name }: { name: string }) {
  const Component = await resolveEeSlotComponent(name);
  if (!Component) {
    return null;
  }
  return <Component />;
}
