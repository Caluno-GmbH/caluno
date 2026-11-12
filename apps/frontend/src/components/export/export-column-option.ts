export type ExportColumnOption = {
  id: string;
  label: string;
  description?: string;
  defaultOn: boolean;
  optional: boolean;
};

export function resolveSelectedColumns(
  options: ExportColumnOption[],
  checkedIds: string[],
): string[] {
  const checked = new Set(checkedIds);
  return options
    .filter((o) => !o.optional || checked.has(o.id))
    .map((o) => o.id);
}
