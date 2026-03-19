import { pgTable, uuid, varchar, char, decimal, text, boolean, date, jsonb, timestamp, index, time, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { branches } from "./branches";
import { agents } from "./agents";

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  employee_code: varchar("employee_code", { length: 50 }).unique(),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  legal_name: varchar("legal_name", { length: 255 }),
  nationality: varchar("nationality", { length: 100 }),
  id_type: varchar("id_type", { length: 20 }),
  id_number: varchar("id_number", { length: 100 }),
  id_expiry: date("id_expiry"),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  email: varchar("email", { length: 255 }),
  password_hash: text("password_hash"),
  role: varchar("role", { length: 30 }).notNull(),
  employment_type: varchar("employment_type", { length: 30 }).notNull().default("full_time"),
  hire_date: date("hire_date"),
  contract_start: date("contract_start"),
  contract_end: date("contract_end"),
  base_salary: decimal("base_salary", { precision: 15, scale: 4 }),
  salary_currency: char("salary_currency", { length: 3 }).default("MYR"),
  commission_config: jsonb("commission_config"),
  incentive_config: jsonb("incentive_config"),
  penalty_applies: boolean("penalty_applies").notNull().default(false),
  agent_id: uuid("agent_id").references(() => agents.id),
  profile_photo: text("profile_photo"),
  bank_name: varchar("bank_name", { length: 100 }),
  bank_account: varchar("bank_account", { length: 100 }),
  bank_country: char("bank_country", { length: 2 }),
  swift_code: varchar("swift_code", { length: 20 }),
  preferred_currency: char("preferred_currency", { length: 3 }).default("MYR"),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_staff_branch").on(table.branch_id),
  index("idx_staff_role").on(table.role),
]);

export const staffSchedules = pgTable("staff_schedules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staff_id: uuid("staff_id").notNull().references(() => staff.id),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  day_of_week: smallint("day_of_week").notNull(),
  shift_start: time("shift_start").notNull(),
  shift_end: time("shift_end").notNull(),
  is_overnight: boolean("is_overnight").notNull().default(false),
  effective_from: date("effective_from").notNull(),
  effective_to: date("effective_to"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staff_id: uuid("staff_id").notNull().references(() => staff.id),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  work_date: date("work_date").notNull(),
  scheduled_start: timestamp("scheduled_start", { withTimezone: true }),
  scheduled_end: timestamp("scheduled_end", { withTimezone: true }),
  clock_in: timestamp("clock_in", { withTimezone: true }),
  clock_out: timestamp("clock_out", { withTimezone: true }),
  status: varchar("status", { length: 30 }).notNull().default("present"),
  late_minutes: decimal("late_minutes", { precision: 10, scale: 0 }).notNull().default("0"),
  early_leave_min: decimal("early_leave_min", { precision: 10, scale: 0 }).notNull().default("0"),
  penalty_amount: decimal("penalty_amount", { precision: 15, scale: 4 }).notNull().default("0"),
  penalty_reason: text("penalty_reason"),
  notes: text("notes"),
  approved_by: uuid("approved_by").references(() => staff.id),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, created_at: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

export const insertStaffScheduleSchema = createInsertSchema(staffSchedules).omit({ id: true, created_at: true });
export type InsertStaffSchedule = z.infer<typeof insertStaffScheduleSchema>;
export type StaffSchedule = typeof staffSchedules.$inferSelect;

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, created_at: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;
