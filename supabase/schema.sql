-- Kronos cloud sync schema.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses "if not exists" / "or replace" where possible.

-- Each synced document mirrors one workspace-scoped storage key as JSONB.
-- localStorage values are stored as JSON strings; IndexedDB blobs as objects.
create table if not exists sync_documents (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  workspace_id text        not null,   -- 'default', 'ws_...', or '__global__'
  doc_key      text        not null,   -- e.g. 'kronos_timesheet_data'
  data         jsonb       not null,
  updated_at   timestamptz not null default now(),
  deleted      boolean     not null default false,
  primary key (user_id, workspace_id, doc_key)
);

-- The workspace list itself (names + tombstones), separate from documents.
create table if not exists workspaces (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         text        not null,
  name       text        not null,
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (user_id, id)
);

alter table sync_documents enable row level security;
alter table workspaces      enable row level security;

-- Each user can only read/write their own rows.
drop policy if exists "own docs" on sync_documents;
create policy "own docs" on sync_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own workspaces" on workspaces;
create policy "own workspaces" on workspaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
