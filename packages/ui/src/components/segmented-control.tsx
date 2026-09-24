'use client';

import { cn } from '../lib/utils';
import { Tabs, TabsList, TabsTrigger } from './base/tabs';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'default' | 'lg';
  variant?: 'default' | 'line';
  triggerClassName?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  size = 'default',
  variant = 'default',
  triggerClassName,
}: SegmentedControlProps) {
  return (
    <Tabs
      value={value}
      onValueChange={onChange}
      className={cn('w-full min-w-0', className)}
    >
      <TabsList
        size={size}
        variant={variant}
        className="grid min-w-full"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(max-content, 1fr))`,
        }}
      >
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className={cn('min-w-max', triggerClassName)}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
