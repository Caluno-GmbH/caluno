import {
  DocumentKind as ApiDocumentKind,
  ReimbursementTypeKey,
} from '@repo/data';
import type { PauschalenType } from '../components/doc-type-header';

const PAUSCHALE_TO_KEY: Record<PauschalenType, ReimbursementTypeKey> = {
  ehrenamt: ReimbursementTypeKey.Ehrenamt,
  uebungsleiter: ReimbursementTypeKey.Uebungsleiter,
};

const KEY_TO_PAUSCHALE: Record<ReimbursementTypeKey, PauschalenType> = {
  [ReimbursementTypeKey.Ehrenamt]: 'ehrenamt',
  [ReimbursementTypeKey.Uebungsleiter]: 'uebungsleiter',
};

/**
 * Translation key (under `Accounting.reimbursements`) for each Pauschale's short
 * label. Kept here so the board and the batch dialog read one map instead of
 * hard-coding the Pauschale ids in their own copies.
 */
export const PAUSCHALE_LABEL_KEY: Record<
  PauschalenType,
  'toolbar.typeEP' | 'toolbar.typeUL'
> = {
  ehrenamt: 'toolbar.typeEP',
  uebungsleiter: 'toolbar.typeUL',
};

/** The prototype's lowercase Pauschale id ↔ the API's ReimbursementTypeKey enum. */
export function reimbursementTypeKeyFor(
  pauschale: PauschalenType,
): ReimbursementTypeKey {
  return PAUSCHALE_TO_KEY[pauschale];
}

export function pauschaleForReimbursementTypeKey(
  key: ReimbursementTypeKey,
): PauschalenType {
  return KEY_TO_PAUSCHALE[key];
}

const KIND_TO_API = {
  contract: ApiDocumentKind.Contract,
  invoice: ApiDocumentKind.Invoice,
} as const;

/** The prototype's lowercase document kind ↔ the API's DocumentKind enum. */
export function apiDocumentKindFor(
  kind: keyof typeof KIND_TO_API,
): ApiDocumentKind {
  return KIND_TO_API[kind];
}
