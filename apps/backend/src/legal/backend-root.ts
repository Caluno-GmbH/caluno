import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolves the backend package root regardless of whether the process was
 * started from the monorepo root or from `apps/backend` (e.g. `bun run dev`
 * runs the task with `apps/backend` as cwd, while some scripts run from root).
 */
export function getBackendRoot(): string {
  const cwd = process.cwd();
  const monorepoBackend = join(cwd, 'apps', 'backend');
  if (existsSync(join(monorepoBackend, 'tsconfig.json'))) {
    return monorepoBackend;
  }
  return cwd;
}
