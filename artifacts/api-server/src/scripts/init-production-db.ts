import { execSync } from "child_process";
import path from "path";
import { pool } from "@workspace/db";

const SQL_FILE = path.join(
  new URL(".", import.meta.url).pathname,
  "prod-full-seed.sql"
);

export async function initProductionDb(): Promise<void> {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    console.warn("[db-init] DATABASE_URL not set, skipping.");
    return;
  }

  try {
    const { rows } = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);

    const tableCount = parseInt(rows[0]?.count ?? "0", 10);

    if (tableCount > 0) {
      console.log(
        `[db-init] DB has ${tableCount} table(s) — skipping full seed.`
      );
      return;
    }

    console.log("[db-init] Empty database detected — applying full seed...");
    execSync(`psql "${dbUrl}" -f "${SQL_FILE}"`, {
      stdio: "inherit",
      timeout: 120_000,
    });
    console.log("[db-init] Full database seed applied successfully.");
  } catch (err) {
    console.error("[db-init] Seed apply failed:", err);
    throw err;
  }
}
