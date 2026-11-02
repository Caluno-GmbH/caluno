'use client';

import { manualFieldMaxLength } from '@repo/data';
import { CharacterCounter } from './character-counter';

interface ManualFieldCounterProps {
  fieldId: string;
  value: string;
}

/** The counter under a manual field's control; renders nothing for fields without a limit. */
export function ManualFieldCounter({
  fieldId,
  value,
}: ManualFieldCounterProps) {
  const max = manualFieldMaxLength(fieldId);
  if (max === undefined) return null;

  return (
    <div className="mt-1">
      <CharacterCounter length={value.length} max={max} />
    </div>
  );
}
