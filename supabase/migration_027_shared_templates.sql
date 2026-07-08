-- Migration: template export/import via a short share code.
-- A user "exports" a template, which snapshots its exercise list (ids +
-- planned/warmup set counts) into this table under a short code. Anyone
-- with the code can "import" it, which creates a new template in their
-- own account from that snapshot. Exercises the importer can't see
-- (someone else's custom exercise) are silently skipped on import — the
-- exercise library itself isn't shared, only the template shape.
create table shared_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  exercises jsonb not null default '[]',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table shared_templates enable row level security;

-- Anyone can look up a code (that's the whole point of sharing one), but
-- only the creator can remove their own share.
create policy "shared_templates_select_all" on shared_templates for select using (true);
create policy "shared_templates_insert_own" on shared_templates for insert with check (auth.uid() = created_by);
create policy "shared_templates_delete_own" on shared_templates for delete using (auth.uid() = created_by);

create index idx_shared_templates_code on shared_templates(code);
