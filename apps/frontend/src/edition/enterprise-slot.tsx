import type { ComponentType } from 'react';
import type { EditionPageModule, EeSlotProps } from './enterprise-extensions';
import { loadEeExtensions } from './load-ee-extensions';
import { ossPages } from './oss-pages';

function isPageModule(
  mod: ComponentType<EeSlotProps> | EditionPageModule,
): mod is EditionPageModule {
  return typeof mod === 'object' && mod !== null && 'default' in mod;
}

function toPageModule(
  mod: ComponentType<EeSlotProps> | EditionPageModule,
): EditionPageModule {
  if (isPageModule(mod)) {
    return mod;
  }
  return { default: mod };
}

/** Resolves a named EE UI slot module, or `undefined` when EE/the slot is absent. */
export async function resolveEeSlotModule(
  name: string,
): Promise<EditionPageModule | undefined> {
  const extensions = await loadEeExtensions();
  const slot = extensions?.slots?.[name];
  if (!slot) {
    return undefined;
  }
  return toPageModule(await slot());
}

/** Resolves a named EE UI slot component, or `undefined` when EE/the slot is absent. */
export async function resolveEeSlotComponent(
  name: string,
): Promise<ComponentType<EeSlotProps> | undefined> {
  const mod = await resolveEeSlotModule(name);
  return mod?.default;
}

/**
 * EE slot first; optional named OSS fallback from `ossPages` when absent.
 * Used by `<EePage />` / `eePageMetadata`.
 */
export async function resolveEditionPageModule(
  ee: string,
  fallback?: string,
): Promise<EditionPageModule | undefined> {
  const eeMod = await resolveEeSlotModule(ee);
  if (eeMod) {
    return eeMod;
  }
  if (!fallback) {
    return undefined;
  }
  const loader = ossPages[fallback];
  if (!loader) {
    return undefined;
  }
  return loader();
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
