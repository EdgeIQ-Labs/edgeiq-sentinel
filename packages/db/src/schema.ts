import { pgTable, text, timestamp, uuid, integer, boolean } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const runs = pgTable('runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  status: text('status').notNull().default('queued'), // queued | running | completed | failed
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  llmModel: text('llm_model'),
  triggerType: text('trigger_type').notNull().default('manual'), // manual | ci | scheduled
  findingsCount: integer('findings_count').default(0).notNull(),
});

export const exploredPages = pgTable('explored_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  url: text('url').notNull(),
  statusCode: integer('status_code'),
  loadTimeMs: integer('load_time_ms'),
  screenshotPath: text('screenshot_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const findings = pgTable('findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  pageId: uuid('page_id').references(() => exploredPages.id),
  type: text('type').notNull(), // bug | a11y | performance | visual | console | network
  severity: text('severity').notNull(), // critical | high | medium | low
  title: text('title').notNull(),
  description: text('description'),
  evidencePath: text('evidence_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const baselines = pgTable('baselines', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  pageIdentifier: text('page_identifier').notNull(),
  screenshotPath: text('screenshot_path').notNull(),
  hash: text('hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assertions = pgTable('assertions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  description: text('description').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ciTriggers = pgTable('ci_triggers', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  webhookSecret: text('webhook_secret').notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Better Auth tables ---
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verifications = pgTable('verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
