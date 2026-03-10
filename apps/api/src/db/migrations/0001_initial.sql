-- IssuePilot Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id INTEGER UNIQUE NOT NULL,
  login TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  access_token TEXT NOT NULL,
  llm_provider TEXT DEFAULT 'openai',
  llm_api_key TEXT,
  llm_model TEXT,
  ollama_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  clone_url TEXT NOT NULL,
  private BOOLEAN DEFAULT FALSE NOT NULL,
  language TEXT,
  description TEXT,
  webhook_id INTEGER,
  indexed BOOLEAN DEFAULT FALSE NOT NULL,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_repositories_user_id ON repositories(user_id);
CREATE UNIQUE INDEX idx_repositories_user_github ON repositories(user_id, github_id);

CREATE TABLE IF NOT EXISTS agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  issue_number INTEGER NOT NULL,
  issue_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  branch_name TEXT,
  pr_url TEXT,
  pr_number INTEGER,
  error TEXT,
  steps JSONB,
  bull_job_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_agent_jobs_user_id ON agent_jobs(user_id);
CREATE INDEX idx_agent_jobs_repository_id ON agent_jobs(repository_id);
CREATE INDEX idx_agent_jobs_status ON agent_jobs(status);

CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_agent_events_job_id ON agent_events(job_id);
