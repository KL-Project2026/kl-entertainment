import { execSync } from "child_process";
import path from "path";
import { pool } from "@workspace/db";

// process.cwd() = workspace root in both dev (tsx) and production (node dist/index.cjs)
const DATA_SEED = path.join(
  process.cwd(),
  "artifacts/api-server/src/scripts/prod-data-seed.sql"
);

export async function initProductionDb(): Promise<void> {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    console.warn("[db-init] DATABASE_URL not set, skipping.");
    return;
  }

  try {
    // Check if meaningful data already exists (customers table is a good proxy)
    const { rows } = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM customers
    `);
    const count = parseInt(rows[0]?.count ?? "0", 10);

    if (count > 0) {
      console.log(`[db-init] DB already has ${count} customer(s) — skipping data seed.`);
      return;
    }

    console.log("[db-init] No seed data found — applying full data seed...");
    execSync(`psql "${dbUrl}" -f "${DATA_SEED}"`, {
      stdio: "inherit",
      timeout: 120_000,
    });
    console.log("[db-init] Data seed applied successfully.");
  } catch (err) {
    // Table might not exist yet (fresh DB before schema runs) — safe to skip
    const msg = String(err);
    if (msg.includes("does not exist") || msg.includes("relation")) {
      console.log("[db-init] Schema not ready yet — skipping (will retry next startup).");
      return;
    }
    console.error("[db-init] Seed apply failed:", err);
    throw err;
  }
}
