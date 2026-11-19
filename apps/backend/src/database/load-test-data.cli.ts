/**
 * Writes the k6 data file (accounts, units, signed session cookies) for the
 * load-test dataset. Needs only the target's BETTER_AUTH_SECRET — no database —
 * so CI can run it against an environment whose database is private.
 *
 *   BETTER_AUTH_SECRET=… bun run load-test:data
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildLoadTestData } from './load-test-plan';

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  console.error('BETTER_AUTH_SECRET is required to sign the session cookies.');
  process.exit(1);
}

const outFile = resolve(
  process.env.LOAD_TEST_OUT ??
    resolve(__dirname, '../../../../packages/load-test/.data/load-test.json'),
);

const writeData = async (signingSecret: string) => {
  const data = buildLoadTestData(signingSecret);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(data));
  console.log(
    `Wrote ${data.units.length} units, ${data.coordinators.length} coordinators and ${data.volunteers.length} volunteers to ${outFile}`,
  );
};

writeData(secret).catch((error) => {
  console.error(error);
  process.exit(1);
});
