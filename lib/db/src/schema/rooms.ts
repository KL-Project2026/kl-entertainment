import { pgTable, uuid, varchar, smallint, decimal, text, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { branches } from "./branches";

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  name: varchar("name", { length: 100 }).notNull(),
  room_type: varchar("room_type", { length: 30 }).notNull().default("private_room"),
  capacity_min: smallint("capacity_min").notNull().default(1),
  capacity_max: smallint("capacity_max").notNull(),
  hourly_rate: decimal("hourly_rate", { precision: 15, scale: 4 }),
  min_hours: decimal("min_hours", { precision: 4, scale: 2 }).notNull().default("1.0"),
  description: text("description"),
  amenities: jsonb("amenities"),
  floor_level: varchar("floor_level", { length: 20 }),
  images: jsonb("images"),
  status: varchar("status", { length: 30 }).notNull().default("available"),
  sort_order: smallint("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_rooms_branch").on(table.branch_id),
]);

export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true, created_at: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
