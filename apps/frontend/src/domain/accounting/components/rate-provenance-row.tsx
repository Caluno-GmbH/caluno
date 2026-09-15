interface RateProvenanceRowProps {
  /** Preformatted line, e.g. "Org default: 4,50 €/hr". Hidden when absent. */
  text?: string;
  className?: string;
}

export function RateProvenanceRow({ text, className }: RateProvenanceRowProps) {
  if (!text) return null;

  return <p className={className ?? 'text-sm text-muted-foreground'}>{text}</p>;
}
