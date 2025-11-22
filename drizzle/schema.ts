import { pgEnum, pgTable, text, timestamp, varchar, integer, boolean, serial } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const languageEnum = pgEnum('language', ['ru', 'en']);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * YouTube API keys table
 * Stores encrypted API keys for each user
 */
export const youtubeApiKeys = pgTable("youtube_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  /** Encrypted API key using AES-256 */
  encryptedApiKey: text("encryptedApiKey").notNull(),
  /** Initialization vector for AES encryption */
  iv: varchar("iv", { length: 32 }).notNull(),
  /** Whether the API key is currently active */
  isActive: boolean("isActive").default(true).notNull(),
  /** Last time the API key was validated */
  lastValidated: timestamp("lastValidated"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type YoutubeApiKey = typeof youtubeApiKeys.$inferSelect;
export type InsertYoutubeApiKey = typeof youtubeApiKeys.$inferInsert;

/**
 * User preferences table
 * Stores user settings like language preference
 */
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique().references(() => users.id),
  /** Language preference: 'ru' or 'en' */
  language: languageEnum("language").default("en").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;
