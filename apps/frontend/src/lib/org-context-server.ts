import {
  isUnauthenticatedDataError,
  LAST_ORG_COOKIE,
  type MyOrganizationUnit,
} from '@repo/data';
import type { OrgUnitContextData } from '@repo/data/react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDataClient } from './data-client';
import { getOrgUnitDisplayName } from './org-display-name';

function normalizeUnits(units: MyOrganizationUnit[]): OrgUnitContextData[] {
  return units
    .map((unit): OrgUnitContextData => {
      const base = {
        id: unit.id,
        slug: unit.slug,
        name: unit.name,
        description: unit.description ?? unit.organization.description ?? null,
        logoUrl: unit.logoUrl ?? unit.organization.logoUrl ?? null,
        street: unit.street,
        zipCode: unit.zipCode,
        city: unit.city,
        legalRep: unit.legalRep,
        organizationId: unit.organization.id,
        accountingEnabled: unit.organization.accountingEnabled,
      };
      return unit.parent === null
        ? { ...base, isRoot: true, rootOrganizationName: undefined }
        : {
            ...base,
            isRoot: false,
            rootOrganizationName: unit.organization.name,
          };
    })
    .sort((a, b) =>
      getOrgUnitDisplayName(a).localeCompare(getOrgUnitDisplayName(b)),
    );
}

export async function getMyOrgUnits(): Promise<OrgUnitContextData[]> {
  const data = await getDataClient();
  const units = await data.organization.findMyOrganizationUnits();

  return normalizeUnits(units);
}

export async function getMyAdministrableOrgUnits(): Promise<
  OrgUnitContextData[]
> {
  const data = await getDataClient();
  const units = await data.organization.findMyAdminstrableOrganizationUnits();

  return normalizeUnits(units);
}

export async function getMyCheckInOrgUnits(): Promise<OrgUnitContextData[]> {
  const data = await getDataClient();
  const units =
    await data.organization.findMyCheckInAdministrableOrganizationUnits();

  return normalizeUnits(units);
}

export async function isAnAdminstrator() {
  try {
    const data = await getDataClient({ redirectOnUnauthenticated: false });
    const units = await data.organization.findMyAdminstrableOrganizationUnits();
    return normalizeUnits(units).length > 0;
  } catch (error) {
    if (isUnauthenticatedDataError(error)) {
      return false;
    }
    throw error;
  }
}

export async function resolveOrgFromId(
  orgUId: string,
): Promise<OrgUnitContextData> {
  const organizations = await getMyAdministrableOrgUnits();
  const org =
    organizations.find((item) => item.id === orgUId) ??
    organizations.find((item) => item.organizationId === orgUId);
  if (!org) {
    return notFound();
  }
  return org;
}

export async function resolveOrgFromSlug(
  orgSlug: string,
): Promise<OrgUnitContextData> {
  const organizations = await getMyAdministrableOrgUnits();
  const org = organizations.find((item) => item.slug === orgSlug);
  if (!org) {
    return notFound();
  }
  return org;
}

export async function isMember(orgUId: string): Promise<boolean> {
  const organizations = await getMyOrgUnits();
  return organizations.some(
    (item) => item.id === orgUId || item.organizationId === orgUId,
  );
}

export async function requireOrgAccess(
  orgUId: string,
): Promise<{ org: OrgUnitContextData; organizations: OrgUnitContextData[] }> {
  const organizations = await getMyAdministrableOrgUnits();
  const org = organizations.find((item) => item.id === orgUId);
  const legacyOrg = organizations.find(
    (item) => item.organizationId === orgUId,
  );

  if (!org && legacyOrg) {
    redirect(`/admin/${legacyOrg.id}`);
  }

  if (org) {
    return { org, organizations };
  }

  const data = await getDataClient();
  const isMember = await data.membership.getMyMembershipStatus(orgUId);
  if (!isMember) {
    redirect('/unauthorized');
  }

  const unit = await data.organizationUnit.findById(orgUId);
  if (!unit) {
    redirect('/unauthorized');
  }

  const base = {
    id: unit.id,
    slug: unit.slug,
    name: unit.name,
    description: unit.description ?? null,
    logoUrl: unit.logoUrl ?? null,
    street: unit.street ?? null,
    zipCode: unit.zipCode ?? null,
    city: unit.city ?? null,
    legalRep: unit.legalRep ?? null,
    organizationId: unit.organizationId ?? '',
    accountingEnabled: false,
  };
  const resolvedOrg: OrgUnitContextData =
    unit.parent === null
      ? { ...base, isRoot: true, rootOrganizationName: undefined }
      : {
          ...base,
          isRoot: false,
          rootOrganizationName: unit.organization.name,
        };

  return { org: resolvedOrg, organizations };
}

export async function getLastVisitedOrgServer(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(LAST_ORG_COOKIE)?.value ?? null;
}
