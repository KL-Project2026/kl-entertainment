/**
 * Manual DB data restore script.
 *
 * Usage:
 *   TARGET_DATABASE_URL="postgres://..." pnpm --filter @workspace/api-server db:restore
 *
 * Applies the full dev data snapshot (prod-data-seed.sql) to the target database.
 * Uses ON CONFLICT DO NOTHING — safe to run multiple times.
 */

import { execSync } from "child_process";
import path from "path";

const DATA_SEED = path.join(
  process.cwd(),
  "artifacts/api-server/src/scripts/prod-data-seed.sql"
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
  console.log("Restoring KL Project data to target...");
  console.log(`  Source: prod-data-seed.sql (dev snapshot — ON CONFLICT DO NOTHING)`);
  console.log(`  Target: ${maskedUrl}`);

  execSync(`psql "${dbUrl}" -f "${DATA_SEED}"`, {
    stdio: "inherit",
    timeout: 120_000,
  });

  console.log("\nData restore complete.");
} catch (err) {
  console.error("Restore failed:", err);
  process.exit(1);
}
