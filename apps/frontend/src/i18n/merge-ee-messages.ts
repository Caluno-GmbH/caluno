type Messages = Record<string, unknown>;

function isMessageTree(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges EE-only messages into the base (OSS) catalog.
 *
 * EE copy can either add a whole new namespace (e.g. `EeNote`) or add keys
 * inside an otherwise-OSS namespace (e.g. `Navigation.myNote`), so this
 * merges recursively rather than replacing whole namespaces. EE values win
 * on a key collision, but collisions are not expected — EE only ever adds
 * keys, it never overrides shared OSS copy.
 */
export function mergeEeMessages(base: Messages, ee: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, eeValue] of Object.entries(ee)) {
    const baseValue = merged[key];
    merged[key] =
      isMessageTree(baseValue) && isMessageTree(eeValue)
        ? mergeEeMessages(baseValue, eeValue)
        : eeValue;
  }
  return merged;
}
