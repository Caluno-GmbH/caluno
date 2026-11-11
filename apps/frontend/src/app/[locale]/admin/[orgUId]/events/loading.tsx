import { Skeleton } from '@repo/ui';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}
