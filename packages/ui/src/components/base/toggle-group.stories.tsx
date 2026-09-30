import type { Meta, StoryObj } from '@storybook/react-vite';
import type { VariantProps } from 'class-variance-authority';
import { Bold, Italic, Underline } from 'lucide-react';
import type { toggleVariants } from '@/components/base/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/base/toggle-group';

// ToggleGroup's props are a single/multiple union, which Storybook's Meta
// cannot infer; the story drives it through a flat args shape instead.
type ToggleGroupStoryArgs = VariantProps<typeof toggleVariants> & {
  type: 'single' | 'multiple';
  disabled?: boolean;
  spacing?: number;
};

/**
 * A set of two-state buttons that can be toggled on or off.
 */
const meta: Meta<ToggleGroupStoryArgs> = {
  title: 'ui/radix/ToggleGroup',
  tags: ['autodocs'],
  argTypes: {
    type: {
      options: ['multiple', 'single'],
      control: { type: 'radio' },
    },
  },
  args: {
    variant: 'default',
    size: 'default',
    type: 'multiple',
    disabled: false,
  },
  render: ({ type, ...args }) => (
    <ToggleGroup type={type as 'multiple'} {...args}>
      <ToggleGroupItem value="bold" aria-label="Toggle bold">
        <Bold className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Toggle italic">
        <Italic className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Toggle underline">
        <Underline className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ToggleGroupStoryArgs>;

/**
 * The default form of the toggle group.
 */
export const Default: Story = {};

/**
 * Use the `outline` variant to emphasizing the individuality of each button
 * while keeping them visually cohesive.
 */
export const Outline: Story = {
  args: {
    variant: 'outline',
  },
};

/**
 * Use the `single` type to create exclusive selection within the button
 * group, allowing only one button to be active at a time.
 */
export const Single: Story = {
  args: {
    type: 'single',
  },
};

/**
 * Use the `sm` size for a compact version of the button group, featuring
 * smaller buttons for spaces with limited real estate.
 */
export const Small: Story = {
  args: {
    size: 'sm',
  },
};

/**
 * Use the `lg` size for a more prominent version of the button group, featuring
 * larger buttons for emphasis.
 */
export const Large: Story = {
  args: {
    size: 'lg',
  },
};

/**
 * Add the `disabled` prop to a button to prevent interactions.
 */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
