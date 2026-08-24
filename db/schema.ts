import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const months = sqliteTable("months", {
  monthKey: text("month_key").primaryKey(),
  label: text("label").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthKey: text("month_key").notNull().references(() => months.monthKey),
  title: text("title").notNull(),
  details: text("details").notNull().default(""),
  taskDate: text("task_date").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
  reviewer: text("reviewer"),
});

export const supervisorSessions = sqliteTable("supervisor_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
