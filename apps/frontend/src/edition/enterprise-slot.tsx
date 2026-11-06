import type { ComponentType } from 'react';
import type { EeSlotProps } from './enterprise-extensions';
import { loadEeExtensions } from './load-ee-extensions';

/** Resolves a named EE UI slot, or `undefined` when EE/the slot is absent. */
export async function resolveEeSlotComponent(
  name: string,
): Promise<ComponentType<EeSlotProps> | undefined> {
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
 * plus `<EeSlot ee="..." />` at the call site, no new OSS file.
 * Extra props (anything except `ee`) are spread onto the loaded component.
 * For full App Router pages that should 404 without EE, use `<EePage />`.
 */
export async function EeSlot({ ee, ...props }: { ee: string } & EeSlotProps) {
  const Component = await resolveEeSlotComponent(ee);
  if (!Component) {
    return null;
  }
  return <Component {...props} />;
}
