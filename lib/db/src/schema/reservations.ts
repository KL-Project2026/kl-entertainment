import { pgTable, uuid, varchar, smallint, decimal, text, boolean, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { branches } from "./branches";
import { customers } from "./customers";
import { rooms } from "./rooms";
import { agents } from "./agents";
import { staff } from "./staff";

export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  reservation_no: varchar("reservation_no", { length: 50 }).unique().notNull(),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  customer_id: uuid("customer_id").references(() => customers.id),
  customer_name: varchar("customer_name", { length: 255 }),
  customer_phone: varchar("customer_phone", { length: 50 }),
  guest_count: smallint("guest_count").notNull().default(1),
  reservation_date: date("reservation_date").notNull(),
  start_time: timestamp("start_time", { withTimezone: true }).notNull(),
  end_time: timestamp("end_time", { withTimezone: true }),
  duration_hours: decimal("duration_hours", { precision: 4, scale: 2 }),
  room_id: uuid("room_id").references(() => rooms.id),
  status: varchar("status", { length: 30 }).notNull().default("tentative"),
  booking_channel: varchar("booking_channel", { length: 30 }).notNull().default("walk_in"),
  referral_code: varchar("referral_code", { length: 50 }),
  agent_id: uuid("agent_id").references(() => agents.id),
  is_outcall: boolean("is_outcall").notNull().default(false),
  special_requests: text("special_requests"),
  internal_notes: text("internal_notes"),
  deposit_amount: decimal("deposit_amount", { precision: 15, scale: 4 }).notNull().default("0"),
  deposit_paid: boolean("deposit_paid").notNull().default(false),
  deposit_paid_at: timestamp("deposit_paid_at", { withTimezone: true }),
  deposit_method: varchar("deposit_method", { length: 30 }),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true }),
  checked_in_at: timestamp("checked_in_at", { withTimezone: true }),
  checked_out_at: timestamp("checked_out_at", { withTimezone: true }),
  cancelled_at: timestamp("cancelled_at", { withTimezone: true }),
  cancellation_reason: text("cancellation_reason"),
  no_show_at: timestamp("no_show_at", { withTimezone: true }),
  created_by: uuid("created_by").references(() => staff.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`NOW()`),
}, (table) => [
  index("idx_reservations_branch_date").on(table.branch_id, table.reservation_date),
  index("idx_reservations_status").on(table.status),
]);

export const reservationHostesses = pgTable("reservation_hostesses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  reservation_id: uuid("reservation_id").notNull().references(() => reservations.id),
  hostess_id: uuid("hostess_id").notNull().references(() => staff.id),
  is_primary: boolean("is_primary").notNull().default(false),
  status: varchar("status", { length: 30 }).notNull().default("assigned"),
  commission_rate_snapshot: decimal("commission_rate_snapshot", { precision: 6, scale: 4 }),
  session_fee: decimal("session_fee", { precision: 15, scale: 4 }),
  notes: text("notes"),
  assigned_by: uuid("assigned_by").references(() => staff.id),
  assigned_at: timestamp("assigned_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const reservationPickups = pgTable("reservation_pickups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  reservation_id: uuid("reservation_id").notNull().references(() => reservations.id),
  driver_id: uuid("driver_id").notNull().references(() => staff.id),
  pickup_address: text("pickup_address").notNull(),
  return_address: text("return_address"),
  pickup_time: timestamp("pickup_time", { withTimezone: true }).notNull(),
  return_time: timestamp("return_time", { withTimezone: true }),
  pickup_fee: decimal("pickup_fee", { precision: 15, scale: 4 }).notNull().default("0"),
  status: varchar("status", { length: 30 }).notNull().default("scheduled"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const insertReservationSchema = createInsertSchema(reservations).omit({ id: true, created_at: true, updated_at: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

export const insertReservationHostessSchema = createInsertSchema(reservationHostesses).omit({ id: true });
export type InsertReservationHostess = z.infer<typeof insertReservationHostessSchema>;
export type ReservationHostess = typeof reservationHostesses.$inferSelect;

export const insertReservationPickupSchema = createInsertSchema(reservationPickups).omit({ id: true, created_at: true });
export type InsertReservationPickup = z.infer<typeof insertReservationPickupSchema>;
export type ReservationPickup = typeof reservationPickups.$inferSelect;
