-- Human Content OS — Supabase setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Sources
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  type text,
  label text,
  content text,
  meta jsonb,
  selected boolean default true,
  created_at timestamptz default now()
);

alter table sources enable row level security;
create policy "Users manage own sources" on sources
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Generated content
create table if not exists generated_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  platform text,
  content text,
  status text default 'draft',
  created_at timestamptz default now()
);

alter table generated_content enable row level security;
create policy "Users manage own generated_content" on generated_content
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Publish log
create table if not exists publish_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  platform text,
  content text,
  status text,
  platform_post_id text,
  created_at timestamptz default now()
);

alter table publish_log enable row level security;
create policy "Users manage own publish_log" on publish_log
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Platform connections (OAuth tokens)
create table if not exists platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  platform text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  meta jsonb,
  created_at timestamptz default now()
);

alter table platform_connections enable row level security;
create policy "Users manage own platform_connections" on platform_connections
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for common queries
create index if not exists idx_sources_user on sources(user_id);
create index if not exists idx_generated_content_user on generated_content(user_id);
create index if not exists idx_publish_log_user on publish_log(user_id, created_at desc);
create index if not exists idx_platform_connections_user on platform_connections(user_id, platform);
