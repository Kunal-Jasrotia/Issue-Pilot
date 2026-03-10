import { pgTable, text, integer, boolean, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').unique().notNull(),
  login: text('login').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  email: text('email'),
  accessToken: text('access_token').notNull(), // encrypted
  llmProvider: text('llm_provider').default('openai'),
  llmApiKey: text('llm_api_key'), // encrypted
  llmModel: text('llm_model'),
  ollamaUrl: text('ollama_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const repositories = pgTable('repositories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  githubId: integer('github_id').notNull(),
  fullName: text('full_name').notNull(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  defaultBranch: text('default_branch').notNull(),
  cloneUrl: text('clone_url').notNull(),
  private: boolean('private').default(false).notNull(),
  language: text('language'),
  description: text('description'),
  webhookId: integer('webhook_id'),
  indexed: boolean('indexed').default(false).notNull(),
  indexedAt: timestamp('indexed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agentJobs = pgTable('agent_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: uuid('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' })
    .notNull(),
  issueNumber: integer('issue_number').notNull(),
  issueTitle: text('issue_title').notNull(),
  status: text('status').notNull().default('queued'), // queued | running | completed | failed
  branchName: text('branch_name'),
  prUrl: text('pr_url'),
  prNumber: integer('pr_number'),
  error: text('error'),
  steps: jsonb('steps').$type<Array<{
    name: string;
    success: boolean;
    output: string;
    duration: number;
  }>>(),
  bullJobId: text('bull_job_id'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agentEvents = pgTable('agent_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .references(() => agentJobs.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
