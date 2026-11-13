export type ExportColumnOption = {
  id: string;
  label: string;
  description?: string;
  defaultOn: boolean;
  optional: boolean;
  group?: string;
};

export function resolveSelectedColumns(
  options: ExportColumnOption[],
  checkedIds: string[],
  enabledGroups?: Record<string, boolean>,
): string[] {
  const checked = new Set(checkedIds);
  const groups = enabledGroups ?? {};
  return options
    .filter((o) => {
      if (o.group && !groups[o.group]) return false;
      return !o.optional || checked.has(o.id);
    })
    .map((o) => o.id);
}
