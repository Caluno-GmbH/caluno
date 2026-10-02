import { API_URL } from '@/lib/constants';

export const PRIVACY_POLICY_PDF_URL = `${API_URL}/legal/privacy-policy.pdf`;

export function buildSignupPayload(input: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  privacyAccepted: boolean;
}): {
  firstname: string;
  lastname: string;
  name: string;
  email: string;
  password: string;
  privacyPolicyAccepted: true;
} | null {
  if (!input.privacyAccepted) {
    return null;
  }

  const firstname = input.firstname.trim();
  const lastname = input.lastname.trim();
  if (!firstname || !lastname) {
    return null;
  }

  return {
    firstname,
    lastname,
    name: `${firstname} ${lastname}`,
    email: input.email,
    password: input.password,
    privacyPolicyAccepted: true,
  };
}
