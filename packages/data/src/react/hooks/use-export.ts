'use client';
import { useQuery } from '@tanstack/react-query';
import type { ExportTable } from '../../generated/base-types';
import {
  type ExportColumnItem,
  type ExportFileResult,
  ExportRepository,
  type ExportRequest,
  type RawExportLogEntry,
} from '../../repositories/export/export.repository';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

export function useExportTableCsv() {
  const sdk = useSdk();
  const repository = new ExportRepository(sdk);

  return useMutation<ExportFileResult, Error, ExportRequest>({
    mutationFn: (input) => repository.exportRows(input),
  });
}

export function useExportColumns(tableKind: ExportTable) {
  const sdk = useSdk();
  const repository = new ExportRepository(sdk);

  return useQuery<ExportColumnItem[]>({
    queryKey: ['export', 'columns', tableKind],
    queryFn: () => repository.listExportColumns(tableKind),
    staleTime: 5 * 60 * 1000,
  });
}

export function useExportLogs(
  tableKind?: ExportTable,
  limit?: number,
  offset?: number,
) {
  const sdk = useSdk();
  const repository = new ExportRepository(sdk);

  return useQuery<RawExportLogEntry[]>({
    queryKey: ['export', 'logs', tableKind, limit, offset],
    queryFn: () => repository.listExportLogs({ tableKind, limit, offset }),
    staleTime: 30 * 1000,
  });
}
