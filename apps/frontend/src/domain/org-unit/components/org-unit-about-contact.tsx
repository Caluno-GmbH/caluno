'use client';

import type { GetOrganizationUnitQuery } from '@repo/data';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import {
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatAddress } from '@/domain/org-unit/format-address';

type OrganizationUnit = NonNullable<
  GetOrganizationUnitQuery['organizationUnit']
>;

/** Read-only about + contact cards shared by Org Units detail and OSS welcome. */
export function OrgUnitAboutContact({
  orgUnit,
}: {
  orgUnit: OrganizationUnit;
}) {
  const t = useTranslations('OrgUnit.detail');
  const addressText = formatAddress(orgUnit);
  const hasContact =
    orgUnit.contactPersonName ||
    orgUnit.contactEmail ||
    orgUnit.phone ||
    orgUnit.websiteUrl ||
    addressText;

  return (
    <>
      {orgUnit.description && (
        <Card className="gap-2 py-4">
          <CardHeader>
            <CardTitle>{t('aboutTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {orgUnit.description}
            </p>
          </CardContent>
        </Card>
      )}

      {hasContact && (
        <Card className="gap-2 py-4">
          <CardHeader>
            <CardTitle>{t('contactTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orgUnit.contactPersonName && (
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{orgUnit.contactPersonName}</span>
              </div>
            )}
            {orgUnit.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <MailIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${orgUnit.contactEmail}`}
                  className="hover:underline"
                >
                  {orgUnit.contactEmail}
                </a>
              </div>
            )}
            {orgUnit.phone && (
              <div className="flex items-center gap-2 text-sm">
                <PhoneIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{orgUnit.phone}</span>
              </div>
            )}
            {orgUnit.websiteUrl && (
              <div className="flex items-center gap-2 text-sm">
                <GlobeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={orgUnit.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline break-all"
                >
                  {orgUnit.websiteUrl}
                </a>
              </div>
            )}
            {addressText ? (
              <div className="flex items-center gap-2 text-sm">
                <MapPinIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{addressText}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}
