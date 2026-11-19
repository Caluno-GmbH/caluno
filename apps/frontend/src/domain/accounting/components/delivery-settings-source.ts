'use client';

import {
  AccountingSettingSourceKind,
  type RawAccountingDeliverySettings,
} from '@repo/data';
import { useTranslations } from 'next-intl';

type SettingSource = RawAccountingDeliverySettings['deliveryMethodSource'];

/** Localized "Inherited from X" / "Custom for this unit" / "Default" label. */
export function useSourceLabel() {
  const t = useTranslations('Accounting.settings.delivery');
  return (source: SettingSource) => {
    switch (source.kind) {
      case AccountingSettingSourceKind.Own:
        return t('source.own');
      case AccountingSettingSourceKind.Inherited:
        return source.sourceName
          ? t('source.inheritedFrom', { source: source.sourceName })
          : t('source.inherited');
      default:
        return t('source.default');
    }
  };
}
