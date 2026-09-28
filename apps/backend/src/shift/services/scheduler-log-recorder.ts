export interface RecordedLog {
  level: 'log' | 'warn' | 'error' | 'debug';
  fields: Record<string, unknown>;
  message: string;
}

export function recordSchedulerLogs(service: object): RecordedLog[] {
  const records: RecordedLog[] = [];
  const record =
    (level: RecordedLog['level']) =>
    (fields: Record<string, unknown>, message: string) => {
      records.push({ level, fields, message });
    };

  (service as { logger: unknown }).logger = {
    log: record('log'),
    warn: record('warn'),
    error: record('error'),
    debug: record('debug'),
  };

  return records;
}

export function findLog(
  records: RecordedLog[],
  event: string,
): RecordedLog | undefined {
  return records.find((entry) => entry.fields.event === event);
}
