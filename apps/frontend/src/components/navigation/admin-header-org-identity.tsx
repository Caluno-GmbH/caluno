import Image from 'next/image';
import { getInitials } from '@/lib/get-initials';

interface AdminHeaderOrgIdentityProps {
  name: string;
  logoUrl?: string | null;
}

/** Compact org-unit lockup for the admin header fallback (logo + name). */
export function AdminHeaderOrgIdentity({
  name,
  logoUrl,
}: AdminHeaderOrgIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="size-8 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground"
        >
          {getInitials(name)}
        </div>
      )}
      <span className="truncate text-lg font-semibold max-sm:sr-only">
        {name}
      </span>
    </div>
  );
}
