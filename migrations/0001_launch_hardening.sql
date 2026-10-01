-- InternOps migration 0001 — launch hardening.
-- Every statement is idempotent so this is safe on a database that was
-- created from shared/schema.ts via drizzle-kit push (fresh/dev/test) AND
-- on the long-lived production database that predates these columns.

-- Task discussion threads.
CREATE TABLE IF NOT EXISTS task_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id varchar NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  company_id varchar NOT NULL REFERENCES companies(id),
  author_user_id varchar NOT NULL REFERENCES users(id),
  content text NOT NULL,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created ON task_comments(task_id, created_at);

-- Pulse Chat history.
CREATE TABLE IF NOT EXISTS assistant_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id varchar NOT NULL REFERENCES companies(id),
  role varchar NOT NULL,
  content text NOT NULL,
  ai_generated boolean NOT NULL DEFAULT false,
  "references" jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_user_created ON assistant_messages(user_id, created_at);

-- How/by whom a shift ended (null while active).
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS end_reason varchar;
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS ended_by_user_id varchar REFERENCES users(id);

-- First-run checklist dismissal.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamp;

-- Concurrency guarantees that used to be application-level only.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_versions_project_version ON plan_versions(project_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_one_general_per_company ON channels(company_id) WHERE type = 'general';

-- Tables the application no longer references. `sessions` and
-- `signup_tokens` were never written to by any live code path.
-- `team_messages` is intentionally NOT dropped here: it may hold legacy
-- rows from before channels existed; drop it by hand once confirmed empty.
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS signup_tokens;
