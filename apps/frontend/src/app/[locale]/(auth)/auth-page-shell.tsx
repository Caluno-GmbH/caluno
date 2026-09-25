import type { ReactNode } from 'react';
import type { PendingInviteOrg } from '@/lib/pending-invite-org';
import { AuthBrand } from './auth-brand';
import { AuthJoinHeader } from './auth-join-header';
import { AuthLocaleToggle } from './auth-locale-toggle';

interface AuthPageShellProps {
  title: string;
  /** Shown under the title when not in invite/join context. */
  description?: string;
  /** When set, replaces brand + title with the invite join lockup. */
  joiningOrg?: PendingInviteOrg | null;
  children: ReactNode;
}

/**
 * Auth layout header:
 * - Join state: org mark → Join {org} → Powered by caluno
 * - Default: caluno wordmark → page title → description
 */
export function AuthPageShell({
  title,
  description,
  joiningOrg,
  children,
}: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen justify-center bg-background px-4 py-10 md:px-6 md:py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          {joiningOrg ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <AuthJoinHeader org={joiningOrg} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8 text-center">
              <AuthBrand />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {title}
                </h1>
                {description ? (
                  <p className="text-sm text-muted-foreground text-pretty">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-6">
            {children}
            <AuthLocaleToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
