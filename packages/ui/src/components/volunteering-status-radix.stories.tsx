import type { Meta, StoryObj } from '@storybook/react-vite';
import { UserPlus, UsersRound } from 'lucide-react';
import { expect, within } from 'storybook/test';
import { Badge } from '@/components/base/badge';
import { Button } from '@/components/base/button';
import { Card } from '@/components/base/card';
import {
  VolunteeringLifecyclePanel,
  VolunteeringMemberListPanel,
  VolunteeringShiftCardVolunteers,
  VolunteeringStatusIcon,
  VolunteeringStatusLabel,
  VolunteeringVolunteerList,
  VolunteeringVolunteerRow,
} from '@/components/volunteering-status';
import type { ShiftVolunteeringDisplayState } from '@/components/volunteering-status/types';

const meta = {
  title: 'ui/Volunteering lifecycle',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function LifecycleSection({
  title,
  subtitle,
  states,
  phase,
}: {
  title: string;
  subtitle: string;
  states: ShiftVolunteeringDisplayState[];
  phase?: 'before' | 'during' | 'after';
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-2">
        {states.map((state) => (
          <VolunteeringLifecyclePanel
            key={state}
            state={state}
            phase={phase}
            completedDuration={state === 'checked_out' ? '3h 57m' : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/** Reference board — all lifecycle states with descriptions and CTAs. */
export const LifecycleReferenceBoard: Story = {
  name: 'Lifecycle reference board',
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <LifecycleSection
        title="Before shift"
        subtitle="Status depends on how they joined."
        phase="before"
        states={['invited', 'requested', 'waitlisted', 'accepted', 'declined']}
      />
      <LifecycleSection
        title="During shift"
        subtitle="Check-in for accepted volunteers. Hover other badges for why."
        phase="during"
        states={[
          'checked_in',
          'invited',
          'requested',
          'waitlisted',
          'declined',
        ]}
      />
      <LifecycleSection
        title="After shift"
        subtitle="Final status is inferred automatically."
        phase="after"
        states={[
          'checked_out',
          'no_show',
          'invited_never_responded',
          'requested_never_responded',
          'declined',
        ]}
      />
    </div>
  ),
};

/** Colored icons alone — reusable signal outside badges. */
export const StatusIcons: Story = {
  name: 'Status icons (reusable)',
  render: () => (
    <div className="flex max-w-xl flex-wrap items-center gap-6">
      {(
        [
          'invited',
          'requested',
          'waitlisted',
          'accepted',
          'declined',
          'checked_in',
          'checked_out',
          'no_show',
        ] as const
      ).map((state) => (
        <div key={state} className="flex flex-col items-center gap-2">
          <VolunteeringStatusIcon state={state} size="md" accessible />
          <span className="text-xs text-muted-foreground">{state}</span>
        </div>
      ))}
    </div>
  ),
};

/** All badge variants in isolation. */
export const StatusBadges: Story = {
  name: 'Status badges',
  render: () => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {(
        [
          'invited',
          'requested',
          'waitlisted',
          'accepted',
          'declined',
          'checked_in',
          'checked_out',
          'no_show',
          'invited_never_responded',
          'requested_never_responded',
        ] as const
      ).map((state) => (
        <VolunteeringStatusLabel
          key={state}
          state={state}
          completedDuration={state === 'checked_out' ? '3h 57m' : undefined}
        />
      ))}
    </div>
  ),
};

const sampleVolunteers = [
  { id: '1', name: 'Katharina Zimmer', state: 'accepted' as const },
  { id: '2', name: 'Hans Test', state: 'invited' as const },
  { id: '3', name: 'Lena Müller', state: 'declined' as const },
  { id: '4', name: 'Tom Becker', state: 'requested' as const },
  { id: '5', name: 'Sara Klein', state: 'accepted' as const },
  { id: '6', name: 'Jana Vogel', state: 'waitlisted' as const },
];

/** Detail page volunteers card — before shift (matches product mockup). */
export const DetailPageBeforeShift: Story = {
  name: 'Detail page / before shift',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <VolunteeringVolunteerList
        phase="before"
        titleBadge={<Badge variant="outline">2 / 8 spots filled</Badge>}
        volunteers={sampleVolunteers}
      />
    </div>
  ),
};

/** During shift — accepted volunteers tracked; others passive (no CTA). */
export const DetailPageDuringShift: Story = {
  name: 'Detail page / during shift',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <VolunteeringVolunteerList
        phase="during"
        titleBadge={<Badge variant="outline">3 / 5 spots filled</Badge>}
        volunteers={[
          { id: '1', name: 'Katharina Zimmer', state: 'checked_in' },
          {
            id: '2',
            name: 'Hans Test',
            state: 'accepted',
            actions: ['Check in'],
          },
          { id: '3', name: 'Lena Müller', state: 'invited' },
          { id: '4', name: 'Tom Becker', state: 'requested' },
          { id: '5', name: 'Sara Klein', state: 'declined' },
        ]}
      />
    </div>
  ),
};

/** After shift — inferred timesheet states. */
export const DetailPageAfterShift: Story = {
  name: 'Detail page / after shift',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <VolunteeringVolunteerList
        phase="after"
        titleBadge={<Badge variant="outline">2 / 4 spots filled</Badge>}
        volunteers={[
          {
            id: '1',
            name: 'Katharina Zimmer',
            state: 'checked_out',
            completedDuration: '3h 57m',
          },
          { id: '2', name: 'Hans Test', state: 'no_show' },
          { id: '3', name: 'Lena Müller', state: 'invited_never_responded' },
          { id: '4', name: 'Tom Becker', state: 'declined' },
        ]}
      />
    </div>
  ),
};

/** Single row playground. */
export const SingleRow: Story = {
  name: 'Single volunteer row',
  render: () => (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <ul className="list-none rounded-xl border px-4">
        <VolunteeringVolunteerRow
          name="Tom Becker"
          state="requested"
          phase="before"
          onAction={() => {}}
        />
      </ul>
      <ul className="list-none rounded-xl border px-4">
        <VolunteeringVolunteerRow
          name="Katharina Zimmer"
          state="accepted"
          phase="before"
          onAction={() => {}}
        />
      </ul>
    </div>
  ),
};

const invitePanelMembers = [
  {
    id: '1',
    name: 'Konstantin Zaituc',
    email: 'testing+002@caluno.org',
    state: 'declined' as const,
  },
  {
    id: '2',
    name: 'Helena Thiomas',
    email: 'testing+006@caluno.org',
    state: 'accepted' as const,
  },
  {
    id: '3',
    name: 'Frau Ylvi Grams',
    email: 'testing+008@caluno.org',
    state: 'accepted' as const,
  },
  {
    id: '4',
    name: 'Noemi Umlauft',
    email: 'testing+010@caluno.org',
    state: 'accepted' as const,
  },
];

/** Shift calendar card — compact name + status icon (accordion). */
export const ShiftCardVolunteers: Story = {
  name: 'Shift card / invited accordion',
  render: () => (
    <Card className="mx-auto max-w-xs gap-1 overflow-hidden rounded-xl px-2 pb-2 pt-4 shadow-sm">
      <div className="flex flex-col items-end gap-2">
        <div className="flex w-full flex-col gap-1">
          <p className="text-lg font-bold leading-none text-muted-foreground">
            11:36 - 12:36
          </p>
          <p className="line-clamp-2 text-lg text-card-foreground">try 1245</p>
        </div>
        <div className="flex w-full items-start gap-1">
          <Badge variant="outline" className="flex-1 justify-center gap-1">
            <UsersRound className="size-3" />3
          </Badge>
          <Button size="icon-sm" variant="outline" aria-label="Invite">
            <UserPlus className="size-4" />
          </Button>
        </div>
      </div>
      <VolunteeringShiftCardVolunteers
        sectionLabel="Invited"
        phase="before"
        volunteers={[
          { id: '1', name: 'Sofie Gabius', state: 'accepted' },
          { id: '2', name: 'Elia Grams', state: 'accepted' },
          { id: '3', name: 'Rico Schaefer', state: 'declined' },
          { id: '4', name: 'Mira Wolf', state: 'waitlisted' },
        ]}
      />
    </Card>
  ),
};

export const ShiftCardWaitlist: Story = {
  name: 'Shift card / waitlist accordion',
  render: () => (
    <Card className="mx-auto max-w-xs gap-1 overflow-hidden rounded-xl px-2 pb-2 pt-4 shadow-sm">
      <VolunteeringShiftCardVolunteers
        sectionLabel="Waitlist"
        phase="before"
        volunteers={[
          {
            id: '1',
            name: 'Jonas M.',
            state: 'waitlisted',
            action: (
              <Button
                size="icon-sm"
                variant="outline"
                tooltip="Invite to the shift"
              >
                <UserPlus className="size-4" />
              </Button>
            ),
          },
          {
            id: '2',
            name: 'Mira Wolf',
            state: 'waitlisted',
            action: (
              <Button
                size="icon-sm"
                variant="outline"
                tooltip="Invite to the shift"
              >
                <UserPlus className="size-4" />
              </Button>
            ),
          },
        ]}
      />
    </Card>
  ),
};

/** Invite sheet — searchable member list with status icons. */
export const InviteMemberPanel: Story = {
  name: 'Invite panel / member list',
  render: () => (
    <div className="mx-auto max-w-sm">
      <VolunteeringMemberListPanel
        title="Invited"
        phase="before"
        members={invitePanelMembers}
      />
    </div>
  ),
};

/** All three surfaces side by side. */
export const SurfaceComparison: Story = {
  name: 'Surfaces comparison',
  render: () => (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Shift card</p>
        <Card className="gap-1 overflow-hidden rounded-xl px-2 pb-2 pt-4 shadow-sm">
          <VolunteeringShiftCardVolunteers
            sectionLabel="Invited"
            phase="before"
            volunteers={[
              { id: '1', name: 'Sofie Gabius', state: 'accepted' },
              { id: '2', name: 'Rico Schaefer', state: 'declined' },
              { id: '3', name: 'Mira Wolf', state: 'waitlisted' },
            ]}
          />
        </Card>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Invite panel</p>
        <VolunteeringMemberListPanel
          title="Invited"
          phase="before"
          members={invitePanelMembers.slice(0, 3)}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Instance detail</p>
        <ul className="list-none rounded-xl border px-4">
          <VolunteeringVolunteerRow
            name="Tom Becker"
            state="requested"
            phase="before"
          />
        </ul>
      </div>
    </div>
  ),
};

export const CheckedOutWithTooltip: Story = {
  name: 'Detail page / checked out (tooltip)',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <VolunteeringVolunteerList
        phase="after"
        titleBadge={<Badge variant="outline">1 checked out</Badge>}
        volunteers={[
          {
            id: '1',
            name: 'Katharina Zimmer',
            state: 'checked_out',
            completedDuration: '7h 12m',
            statusTooltip: (
              <div className="flex flex-col gap-0.5 text-xs">
                <span>08:00 – 12:00</span>
                <span>13:00 – 15:30</span>
                <span>16:00 – 17:00</span>
                <span>17:30 – 18:30</span>
                <span>19:00 – 20:12</span>
                <span>+2 more</span>
              </div>
            ),
          },
        ]}
      />
    </div>
  ),
};

/**
 * Mobile row layout, pinned to 375px so the two-line behaviour is always visible.
 * Deliberately all-German: German is the widest locale, so this is the worst case
 * the layout has to survive. Row 2 is the stress case and is expected to spill onto
 * a third line; see the comment on that row.
 */
export const MobileRowLayout: Story = {
  name: 'Detail page / mobile row layout',
  render: () => (
    <div className="w-[375px] border border-dashed border-border p-4">
      <VolunteeringVolunteerList
        phase="before"
        titleBadge={<Badge variant="outline">2 / 8 Plätze besetzt</Badge>}
        actionLabels={{
          View: 'Ansehen',
          'Check in': 'Einchecken',
          Approve: 'Genehmigen',
          Uninvite: 'Entfernen',
        }}
        volunteers={[
          {
            // Long name, to prove truncation behaves on line 1.
            id: '1',
            name: 'Alexandra Schmidt-Hohenberg',
            state: 'accepted',
            statusLabel: 'Angenommen',
            iconActions: ['View', 'Check in'],
          },
          {
            // Worst case: the longest German status label beside a text action.
            // Line 2 needs more width than 375px leaves after the pl-11 indent,
            // so the button wraps under the chip and this row takes three lines.
            id: '2',
            name: 'Jo Fischer',
            state: 'requested',
            statusLabel: 'Genehmigung ausstehend',
            actions: ['Approve'],
            iconActions: ['View', 'Check in'],
          },
          {
            // No text action at all, so line 2 is a bare status chip.
            id: '3',
            name: 'Tom Becker',
            state: 'declined',
            statusLabel: 'Abgelehnt',
            actions: [],
            iconActions: ['View'],
          },
        ]}
      />
    </div>
  ),
};

/** Open status dropdown — options must look identical to the closed trigger. */
export const StatusDropdownOpen: Story = {
  name: 'Detail page / status dropdown',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <VolunteeringVolunteerList
        phase="before"
        titleBadge={<Badge variant="outline">1 / 8 spots filled</Badge>}
        actionLabels={{
          View: 'View',
          'Check in': 'Check in',
          Approve: 'Approve',
        }}
        onStatusChange={() => {}}
        volunteers={[
          {
            // Two transitions offered.
            id: '1',
            name: 'Jo Fischer',
            state: 'requested',
            statusLabel: 'Pending approval',
            statusMenuAriaLabel: 'Change volunteer status',
            statusOptions: [
              { value: 'JOINED', label: 'Accepted', state: 'accepted' },
              { value: 'ADMIN_REJECTED', label: 'Removed', state: 'rejected' },
            ],
            actions: ['Approve'],
            iconActions: ['View', 'Check in'],
          },
          {
            // One transition offered, the case that reads worst today.
            id: '2',
            name: 'Katharina Zimmer',
            state: 'accepted',
            statusLabel: 'Accepted',
            statusMenuAriaLabel: 'Change volunteer status',
            statusOptions: [
              { value: 'ADMIN_REJECTED', label: 'Removed', state: 'rejected' },
            ],
            actions: [],
            iconActions: ['View', 'Check in'],
          },
          {
            // No transitions, so this row must stay a static badge with no chevron.
            id: '3',
            name: 'Tom Becker',
            state: 'declined',
            statusLabel: 'Declined',
            actions: [],
            iconActions: ['View'],
          },
        ]}
      />
    </div>
  ),
};

/**
 * Regression coverage for the bug fixed by this story's PR: Check in / Check
 * out are *text* buttons (unlike the icon-only View button), so putting a
 * per-volunteer named phrase straight into `actionLabels` made the button
 * literally read "Check in Jo Fischer" (German: "Jo Fischer einchecken" —
 * see commit 1db71fed). The fix renders the plain visible label plus a
 * hidden (sr-only) span carrying the full accessible phrase, so sighted
 * users still see just "Check in" while screen readers announce the
 * volunteer's name.
 */
export const AccessibleCheckInName: Story = {
  name: 'Detail page / accessible check-in name (regression)',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <VolunteeringVolunteerList
        phase="during"
        titleBadge={<Badge variant="outline">1 / 1 spots filled</Badge>}
        actionLabels={{ 'Check in': 'Check in' }}
        volunteers={[
          {
            id: '1',
            name: 'Jo Fischer',
            state: 'accepted',
            actions: ['Check in'],
            // Per-volunteer accessible phrase — must NOT appear in the
            // visible button text, only in the hidden sr-only span.
            accessibleActionLabels: {
              'Check in': 'Check in Jo Fischer',
            },
          },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The visible label stays the plain action name — this is the assertion
    // that fails if the accessible phrase leaks back into the visible text.
    const visibleLabel = await canvas.findByText('Check in', {
      selector: 'span[aria-hidden="true"]',
    });
    expect(visibleLabel.textContent).toBe('Check in');
    expect(visibleLabel.textContent).not.toContain('Jo Fischer');

    // The full accessible phrase is still exposed, just hidden visually.
    const button = await canvas.findByRole('button', {
      name: 'Check in Jo Fischer',
    });
    expect(button).toBeInTheDocument();
  },
};
