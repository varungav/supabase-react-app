-- Tasks table: a minimal CRUD example wired up in the Dashboard's "Tasks" card.
-- Each row belongs to exactly one user (auth.uid()) and is fully isolated via RLS.

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  is_complete boolean not null default false,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

alter table public.tasks enable row level security;

-- Read: users can only see their own tasks.
create policy "Users can view their own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

-- Create: users can only insert tasks for themselves.
create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

-- Update: users can only update their own tasks.
create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Delete: users can only delete their own tasks.
create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- Keep updated_at current on every row change.
create or replace function public.set_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute procedure public.set_tasks_updated_at();
