import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '@/components/base/badge';

/**
 * Displays a badge or a component that looks like a badge.
 */
const meta = {
  title: 'ui/radix/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'neutral',
        'destructive',
        'outline',
        'info',
        'success',
        'alert',
        'error',
        'ghost',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['default', 'count'],
    },
    children: {
      control: 'text',
      description: 'Badge content',
    },
  },
  args: {
    variant: 'default',
    size: 'default',
    children: 'Badge',
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the badge.
 */
export const Default: Story = {};

/**
 * Use the `secondary` badge to call for less urgent information, blending
 * into the interface while still signaling minor updates or statuses.
 */
export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};

/**
 * Use the `neutral` badge for low-emphasis, informational labels and counts
 * that blend into the interface using the muted surface.
 */
export const Neutral: Story = {
  args: {
    variant: 'neutral',
  },
};

/**
 * Use the `destructive` badge to  indicate errors, alerts, or the need for
 * immediate attention.
 */
export const Destructive: Story = {
  args: {
    variant: 'destructive',
  },
};

/**
 * Use the `outline` badge for overlaying without obscuring interface details,
 * emphasizing clarity and subtlety..
 */
export const Outline: Story = {
  args: {
    variant: 'outline',
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
  },
};

/**
 * Use the `alert` badge to flag warnings or near-limit states that need
 * attention without being as severe as an error.
 */
export const Alert: Story = {
  args: {
    variant: 'alert',
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
  },
};

/**
 * Use `size="count"` for compact, circular numeric indicators such as
 * notification or pending-item counts. Pair with `destructive` for urgent
 * counts.
 */
export const Count: Story = {
  args: {
    variant: 'destructive',
    size: 'count',
    children: '3',
  },
};

/**
 * A neutral numeric count indicator, e.g. a sidebar item count.
 */
export const CountNeutral: Story = {
  args: {
    variant: 'neutral',
    size: 'count',
    children: '12',
  },
};
