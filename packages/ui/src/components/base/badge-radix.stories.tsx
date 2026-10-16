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
        'neutral',
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
 * Use the `neutral` badge for low-emphasis, informational labels and counts
 * that blend into the interface using the muted surface.
 */
export const Neutral: Story = {
  args: {
    variant: 'neutral',
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

/**
 * Use the `error` badge for errors or rejected states — an outlined red,
 * the replacement for the former filled `destructive` badge.
 */
export const Error: Story = {
  args: {
    variant: 'error',
  },
};

/**
 * Use `size="count"` for compact, circular numeric indicators such as
 * notification or pending-item counts.
 */
export const Count: Story = {
  args: {
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
