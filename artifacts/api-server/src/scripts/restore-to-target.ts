/**
 * Manual DB restore script.
 *
 * Usage:
 *   TARGET_DATABASE_URL="postgres://..." pnpm --filter @workspace/api-server db:restore
 *
 * Applies the full dev snapshot (prod-full-seed.sql) to the target database.
 * SAFE: skips if the target already has tables.
 */

import { execSync } from "child_process";
import path from "path";

const SQL_FILE = path.join(
  new URL(".", import.meta.url).pathname,
  "prod-full-seed.sql"
);

const dbUrl =
  process.env["TARGET_DATABASE_URL"] ?? process.env["DATABASE_URL"];

if (!dbUrl) {
  console.error(
    "ERROR: Set TARGET_DATABASE_URL (or DATABASE_URL) to the destination database."
  );
  process.exit(1);
}

const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":***@");

try {
  const result = execSync(
    `psql "${dbUrl}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"`,
    { timeout: 15_000 }
  )
    .toString()
    .trim();

  const tableCount = parseInt(result, 10);

  if (tableCount > 0) {
    console.log(
      `Target DB already has ${tableCount} table(s).\n` +
        `To force overwrite, drop the schema first:\n` +
        `  psql "$TARGET_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"\n` +
        `Then re-run: pnpm --filter @workspace/api-server db:restore`
    );
    process.exit(0);
  }

  console.log("Restoring KL Project database to target...");
  console.log(`  Source: prod-full-seed.sql`);
  console.log(`  Target: ${maskedUrl}`);

  execSync(`psql "${dbUrl}" -f "${SQL_FILE}"`, {
    stdio: "inherit",
    timeout: 120_000,
  });

  console.log("\nDatabase restore complete.");
} catch (err) {
  console.error("Restore failed:", err);
  process.exit(1);
}
