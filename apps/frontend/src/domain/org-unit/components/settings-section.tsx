import { type ReactNode, useId } from 'react';

interface SettingsSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

// Heading → description 4, heading block → cards 16, card ↔ card 16; sections
// themselves sit 24 apart in the page (DESIGN.md Proximity Spacing Scale).
export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <h2 id={headingId} className="text-xl font-bold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
