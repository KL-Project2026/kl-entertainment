import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// MIGRATION: Supabase pooler self-signed cert 수용 — rejectUnauthorized false when Supabase URL detected
const isSupabase = process.env.DATABASE_URL?.includes("supabase");
const sslConfig = isSupabase
  ? { rejectUnauthorized: false }
  : process.env.NODE_ENV === "production"
    ? true
    : undefined;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig as Parameters<typeof Pool>[0]["ssl"],
});
export const db = drizzle(pool, { schema });

export * from "./schema";
