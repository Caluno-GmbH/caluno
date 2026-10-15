import { afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import type { TestingModule } from '@nestjs/testing';
import { Client } from 'pg';

let cachedTestDatabaseName: string | undefined;
let ensurePromise: Promise<string> | null = null;
const resourceCleanups: Array<() => Promise<void>> = [];

const getBackendRoot = () => {
  const cwd = process.cwd();
  return cwd.endsWith('apps/backend') ? cwd : `${cwd}/apps/backend`;
};

const createAdminClient = () =>
  new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    ssl: false,
  });

export const getTestDatabaseName = (): string => {
  if (cachedTestDatabaseName) {
    return cachedTestDatabaseName;
  }

  const baseName = process.env.POSTGRES_DB ?? 'caluno';
  const normalizedBase = baseName.replace(/_test.*$/, '');
  cachedTestDatabaseName = `${normalizedBase}_test_${process.pid}_${Date.now().toString(36)}`;
  return cachedTestDatabaseName;
};

export const applyTestDatabaseEnvironment = (): string => {
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST ??= 'localhost';
  process.env.DB_PORT ??= process.env.POSTGRES_PORT ?? '5432';
  process.env.DB_USER ??= process.env.POSTGRES_USER ?? 'postgres';
  process.env.DB_PASSWORD ??= process.env.POSTGRES_PASSWORD ?? 'postgres';
  // Cap per-module pools so concurrent TestingModules stay under Postgres
  // max_connections (~100). Each module ends its own pool on close.
  process.env.DB_POOL_MAX ??= '5';
  process.env.DB_POOL_IDLE_TIMEOUT_MS ??= '10000';

  const testDbName = getTestDatabaseName();
  process.env.DB_NAME = testDbName;
  return testDbName;
};

export const registerTestResourceCleanup = (
  cleanup: () => Promise<void>,
): void => {
  resourceCleanups.push(cleanup);
};

/**
 * Close a Nest TestingModule when its describe finishes so the pg Pool is
 * released before the next file opens another. Call at describe-body top
 * level (not inside beforeAll) so the afterAll hook registers correctly.
 */
export const closeTestingModuleAfterAll = (
  getModuleRef: () => TestingModule | undefined,
): void => {
  afterAll(async () => {
    await getModuleRef()?.close();
  });
};

export const createFreshTestDatabase = async (
  testDbName: string,
): Promise<void> => {
  const adminClient = createAdminClient();
  await adminClient.connect();

  try {
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}";`);
    await adminClient.query(`CREATE DATABASE "${testDbName}";`);
    console.log(`Created fresh test database ${testDbName}.`);
  } finally {
    await adminClient.end();
  }
};

export const dropTestDatabase = async (testDbName: string): Promise<void> => {
  const adminClient = createAdminClient();
  await adminClient.connect();

  try {
    await adminClient.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [testDbName],
    );
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}";`);
    console.log(`Dropped test database ${testDbName}.`);
  } finally {
    await adminClient.end();
  }
};

export const runMigrationsAndSeed = (testDbName: string): void => {
  const backendRoot = getBackendRoot();

  const migrateResult = spawnSync(
    'node_modules/.bin/drizzle-kit',
    ['migrate'],
    {
      cwd: backendRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        DB_NAME: testDbName,
      },
    },
  );

  if (migrateResult.status !== 0) {
    throw new Error('Failed to migrate test database.');
  }

  const seedResult = spawnSync('bun', ['src/database/seed.ts'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DB_NAME: testDbName,
    },
  });

  if (seedResult.status !== 0) {
    throw new Error('Failed to seed test database.');
  }
};

export const teardownTestDatabase = async (): Promise<void> => {
  const testDbName = cachedTestDatabaseName;

  for (const cleanup of [...resourceCleanups].reverse()) {
    await cleanup();
  }
  resourceCleanups.length = 0;

  if (testDbName) {
    await dropTestDatabase(testDbName);
    cachedTestDatabaseName = undefined;
    ensurePromise = null;
  }
};

export const ensureTestDatabase = async (): Promise<string> => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const testDbName = applyTestDatabaseEnvironment();
      await createFreshTestDatabase(testDbName);
      runMigrationsAndSeed(testDbName);
      return testDbName;
    })();
  }

  return ensurePromise;
};
