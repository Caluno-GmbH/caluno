'use client';

import { Button } from '@repo/ui';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TranslatableRole } from '@/domain/role/lib/role-label';
import { internalRoleKey } from '@/domain/role/lib/role-label';
import type { VolunteerCsvColumnId } from '@/domain/volunteer/volunteers-csv';
import { serializeVolunteersToCsv } from '@/domain/volunteer/volunteers-csv';
import { triggerDownload } from '@/lib/download/trigger-download';
import { useFormatting } from '@/lib/formatting/use-formatting';

type CsvMembership = {
  user: {
    name: string | null | undefined;
    email: string | null | undefined;
    preferredName: string | null | undefined;
    birthdate: string | null | undefined;
    gender: string | null | undefined;
    phone: string | null | undefined;
    street: string | null | undefined;
    zip: string | null | undefined;
    city: string | null | undefined;
  };
  roles: Array<{ name: string; isInternal?: boolean | null }>;
};

const OPTIONAL_TO_CSV: Record<string, VolunteerCsvColumnId> = {
  dateOfBirth: 'dateOfBirth',
  gender: 'gender',
  phone: 'phone',
  address: 'address',
};

interface DownloadVolunteersCsvButtonProps {
  orgUId: string;
  rows: CsvMembership[];
  visibleColumnIds: string[];
}

export function DownloadVolunteersCsvButton({
  orgUId,
  rows,
  visibleColumnIds,
}: DownloadVolunteersCsvButtonProps) {
  const t = useTranslations('Volunteer');
  const tRole = useTranslations('Role');
  const { formatDate } = useFormatting();

  const handleClick = () => {
    const optionalCsvIds = visibleColumnIds
      .filter((id) => id in OPTIONAL_TO_CSV)
      .map((id) => OPTIONAL_TO_CSV[id] as VolunteerCsvColumnId);

    const columnIds: VolunteerCsvColumnId[] = [
      'name',
      'email',
      'roles',
      ...optionalCsvIds,
    ];

    const headers: Record<VolunteerCsvColumnId, string> = {
      name: t('table.name'),
      email: t('table.email'),
      roles: t('table.roles'),
      dateOfBirth: t('table.dateOfBirth'),
      gender: t('table.gender'),
      phone: t('table.phone'),
      address: t('table.address'),
    };

    const roleLabel = (role: TranslatableRole) => {
      const key = internalRoleKey(role);
      return key ? tRole(key) : role.name;
    };

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const csv = serializeVolunteersToCsv(
      rows,
      columnIds,
      headers,
      roleLabel,
      (d: Date) => formatDate(d),
      now,
    );

    triggerDownload(`volunteers-${orgUId}-${today}.csv`, csv);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Download className="size-4" />
      {t('table.downloadCsv')}
    </Button>
  );
}
