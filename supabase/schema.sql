-- Схема Receitas. Применить в Supabase → SQL Editor → New query → Run.
-- RLS включён: каждый пользователь видит и меняет только свои рецепты.

create extension if not exists "pgcrypto";

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  intro       text,
  servings    integer,
  groups      jsonb not null default '[]'::jsonb,  -- StoredGroup[]
  steps       jsonb not null default '[]'::jsonb,  -- StoredStep[]
  tips        jsonb not null default '[]'::jsonb,  -- string[]
  image_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists recipes_user_created_idx
  on public.recipes (user_id, created_at desc);

alter table public.recipes enable row level security;

-- Политики: доступ только к своим строкам (auth.uid() = user_id).
drop policy if exists "recipes_select_own" on public.recipes;
create policy "recipes_select_own" on public.recipes
  for select using (auth.uid() = user_id);

drop policy if exists "recipes_insert_own" on public.recipes;
create policy "recipes_insert_own" on public.recipes
  for insert with check (auth.uid() = user_id);

drop policy if exists "recipes_update_own" on public.recipes;
create policy "recipes_update_own" on public.recipes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recipes_delete_own" on public.recipes;
create policy "recipes_delete_own" on public.recipes
  for delete using (auth.uid() = user_id);
