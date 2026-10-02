'use client';

import { createContext, type ReactNode, useContext } from 'react';

interface BaseOrgUnitContextData {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
  legalRep?: string | null;
  organizationId: string;
  accountingEnabled: boolean;
}

interface NestedOrgUnitContextData extends BaseOrgUnitContextData {
  isRoot: false;
  rootOrganizationName: string;
}

interface RootOrgUnitContextData extends BaseOrgUnitContextData {
  isRoot: true;
  rootOrganizationName: undefined;
}

export type OrgUnitContextData =
  | NestedOrgUnitContextData
  | RootOrgUnitContextData;

interface OrgContextValue {
  org: OrgUnitContextData;
  organizations: OrgUnitContextData[];
}

const OrgContext = createContext<OrgContextValue | null>(null);

export interface OrgProviderProps {
  children: ReactNode;
  org: OrgUnitContextData;
  organizations: OrgUnitContextData[];
}

export function OrgProvider({
  children,
  org,
  organizations,
}: OrgProviderProps) {
  return (
    <OrgContext.Provider value={{ org, organizations }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within OrgProvider');
  }
  return context;
}

export function useOrgUId(): string {
  return useOrg().org.id;
}

export function useOrgSlug(): string {
  return useOrg().org.slug;
}

export function useCurrentOrg(): OrgUnitContextData {
  return useOrg().org;
}

export function useUserOrganizations(): OrgUnitContextData[] {
  return useOrg().organizations;
}
