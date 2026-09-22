export interface MembershipApprovedContactPayload {
  contactPersonName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  welcomeMessage?: string | null;
}

export interface MembershipApprovedPayload {
  organizationUnitId: string;
  organizationName: string;
  userId: string;
  contact?: MembershipApprovedContactPayload | null;
}
