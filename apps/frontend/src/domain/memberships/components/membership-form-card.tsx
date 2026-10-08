import type { MyRequiredOrgUnitFormsQuery } from '@repo/data';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui';
import { FileText, SquareArrowOutUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getFormatting } from '@/lib/formatting/formatting-server';

type OrgUnitForm =
  MyRequiredOrgUnitFormsQuery['myRequiredOrgUnitForms'][number];

export type FormSubmission = {
  form: OrgUnitForm;
  organizationUnitId: string;
  completed: boolean;
  submissionId?: string;
  submittedAt?: string;
};

type MembershipFormCardProps = {
  submission: FormSubmission;
};

export const MembershipFormCard = async ({
  submission,
}: MembershipFormCardProps) => {
  const t = await getTranslations('MembershipDetail.forms');
  const { formatDate } = await getFormatting();

  const statusLabel = t(
    submission.completed ? 'status.completed' : 'status.notCompleted',
  );
  const description = submission.completed
    ? t('completedOn', {
        date: submission.submittedAt
          ? formatDate(new Date(submission.submittedAt))
          : '',
      })
    : t('notCompletedPrompt');

  const actionLabel = t(submission.completed ? 'view' : 'fillIn');
  const actionHref = submission.completed
    ? `/profile/forms/submissions/${submission.submissionId}`
    : `/orgs/${submission.organizationUnitId}/forms/${submission.form.shareToken}`;

  return (
    <Card>
      {/*
        Plain flex instead of CardHeader's `grid-cols-[1fr_auto]`. That grid's
        `1fr` is `minmax(auto, 1fr)`, so its floor was the title's min-content —
        and `truncate` makes min-content the whole string, so the column could
        never shrink and the badge was pushed outside the card (VOLI-1594).
      */}
      <CardHeader className="flex items-start gap-2">
        <div className="bg-muted p-2 border rounded-lg shrink-0">
          <FileText className="text-muted-foreground size-4" />
        </div>
        {/*
          The icon sits outside this row on purpose. This is the row that wraps,
          so wherever it starts is where the badge lands when it drops to its own
          line — which is exactly the name's left edge. With the icon inside, the
          badge wrapped under the icon instead of lining up with the name.

          `basis-3/5` is what makes it drop only when the name needs the room:
          measured inline at a 442px card, on its own line from ~372px down. With
          `flex-1` the basis would be 0, so the name would squeeze to a sliver and
          the badge would never wrap at all.
        */}
        <div className="flex min-w-0 grow flex-wrap items-start justify-between gap-2">
          {/* Wraps instead of truncating: the form name is what the volunteer
              picks by, and at phone width truncation left "Vereinb…". */}
          <CardTitle className="min-w-0 grow basis-3/5 leading-snug hyphens-auto break-words">
            {submission.form.name}
          </CardTitle>
          <Badge
            variant={submission.completed ? 'success' : 'alert'}
            className="shrink-0"
          >
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm mb-2">{description}</p>
        <Button asChild className="w-full sm:w-auto">
          <Link
            href={actionHref}
            target={submission.completed ? '' : '_blank'}
            rel="noopener noreferrer"
          >
            {!submission.completed && <SquareArrowOutUpRight />}
            {actionLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
