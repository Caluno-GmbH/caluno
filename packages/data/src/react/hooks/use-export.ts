'use client';
import { useQuery } from '@tanstack/react-query';
import type { ExportTable, ExportTableInput } from '../../generated/base-types';
import {
  type ExportFileResult,
  ExportRepository,
  type RawExportLogEntry,
} from '../../repositories/export/export.repository';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

export function useExportTableCsv() {
  const sdk = useSdk();
  const repository = new ExportRepository(sdk);

  return useMutation<ExportFileResult, Error, ExportTableInput>({
    mutationFn: (input) => repository.exportTableCsv(input),
  });
}

export function useExportLogs(tableKind?: ExportTable) {
  const sdk = useSdk();
  const repository = new ExportRepository(sdk);

  return useQuery<RawExportLogEntry[]>({
    queryKey: ['export', 'logs', tableKind],
    queryFn: () => repository.listExportLogs(tableKind),
    staleTime: 30 * 1000,
    enabled: true,
  });
}
