import { defineConfig } from 'drizzle-kit';

/**
 * Enterprise Edition migration stream.
 * Separate `out` folder + ledger table so OSS mirrors never see these files
 * (this whole `src/ee/` tree is filtered) and never apply them.
 *
 * Generate: `bun run db:generate:ee`
 * Migrate:  included from `bun run db:migrate` when `src/ee` exists
 */
export default defineConfig({
  schema: './src/ee/**/schemas/*.ts',
  out: './src/ee/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT as string, 10),
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_NAME as string,
    ssl: false,
  },
  migrations: {
    schema: 'public',
    table: '__drizzle_migrations_ee',
  },
});
