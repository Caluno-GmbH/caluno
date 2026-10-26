export type ShiftListView = 'weekplan' | 'shifts';

const CHECK_IN_URL_PATTERN = /\/admin\/check-in\/([a-z0-9]{12})(?:[/?#]|$)/i;

export function extractCheckInPath(scannedValue: string): string | null {
  const match = scannedValue.match(CHECK_IN_URL_PATTERN);
  return match ? `/check-in/${match[1]?.toLowerCase()}/decide` : null;
}

function orgUIdParam(orgUId?: string): string {
  return orgUId ? `orgUId=${encodeURIComponent(orgUId)}` : '';
}

export function checkInPath(checkInId: string, orgUId?: string): string {
  const query = orgUIdParam(orgUId);
  return `/check-in/${checkInId}/check-in${query ? `?${query}` : ''}`;
}

export function checkOutPath(
  checkInId: string,
  entryId: string,
  orgUId?: string,
): string {
  const query = orgUIdParam(orgUId);
  return `/check-in/${checkInId}/check-out?entryId=${encodeURIComponent(entryId)}${query ? `&${query}` : ''}`;
}

export type ShiftListQuery = {
  view?: ShiftListView;
  week?: string;
  page?: string;
  // Table state carried to the detail page so "back" restores the same rows.
  pageSize?: string;
  sort?: string;
  dir?: string;
  q?: string;
};

const SHIFT_LIST_QUERY_KEYS = [
  'view',
  'week',
  'page',
  'pageSize',
  'sort',
  'dir',
  'q',
] as const satisfies readonly (keyof ShiftListQuery)[];

function parseQuery(query?: ShiftListQuery) {
  const params = new URLSearchParams();
  for (const key of SHIFT_LIST_QUERY_KEYS) {
    const value = query?.[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function shiftsListPath(
  orgUId: string,
  query: ShiftListQuery = {},
): string {
  const queryString = parseQuery(query);
  return `/admin/${orgUId}/shifts${queryString ? `?${queryString}` : ''}`;
}

export function shiftDetailPath(
  orgUId: string,
  shiftId: string,
  query?: ShiftListQuery,
): string {
  const queryString = parseQuery(query);
  return `/admin/${orgUId}/shifts/${shiftId}${queryString ? `?${queryString}` : ''}`;
}

export function shiftNewPath(orgUId: string): string {
  return `/admin/${orgUId}/shifts/new`;
}

export function shiftEditPath(orgUId: string, shiftId: string): string {
  return `/admin/${orgUId}/shifts/${shiftId}/edit`;
}

export function shiftDuplicatePath(
  orgUId: string,
  shiftId: string,
  options?: { redirectToDetail?: boolean },
): string {
  const query = options?.redirectToDetail ? '?redirect=detail' : '';
  return `/admin/${orgUId}/shifts/${shiftId}/duplicate${query}`;
}

export function shiftInvitePath(
  orgUId: string,
  shiftId: string,
  instanceId: string,
  options?: { flow?: 'create' },
): string {
  const params = new URLSearchParams({ instanceId });
  if (options?.flow) {
    params.set('flow', options.flow);
  }
  return `/admin/${orgUId}/shifts/${shiftId}/invite?${params.toString()}`;
}

export function shiftInstanceDetailPath(
  orgUId: string,
  shiftId: string,
  instanceId: string,
  query?: ShiftListQuery,
): string {
  const queryString = parseQuery(query);
  return `/admin/${orgUId}/shifts/${shiftId}/instances/${instanceId}${queryString ? `?${queryString}` : ''}`;
}

export function shiftInstanceEditPath(
  orgUId: string,
  shiftId: string,
  instanceId: string,
): string {
  return `/admin/${orgUId}/shifts/${shiftId}/instances/${instanceId}/edit`;
}

export function parseShiftListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ShiftListQuery {
  const view = searchParams.view;
  const str = (key: Exclude<keyof ShiftListQuery, 'view'>) => {
    const value = searchParams[key];
    return typeof value === 'string' ? value : undefined;
  };

  return {
    view:
      view === 'shifts'
        ? 'shifts'
        : view === 'weekplan'
          ? 'weekplan'
          : undefined,
    week: str('week'),
    page: str('page'),
    pageSize: str('pageSize'),
    sort: str('sort'),
    dir: str('dir'),
    q: str('q'),
  };
}
