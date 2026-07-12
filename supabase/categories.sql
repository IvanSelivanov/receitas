-- Категории (метки) рецептов. Применить в Supabase → SQL Editor → Run.
-- Рецепт может иметь несколько категорий (many-to-many). У каждого пользователя
-- свой набор. Дефолты сеются при регистрации и разово для текущих пользователей.

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.recipe_categories (
  recipe_id   uuid not null references public.recipes (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (recipe_id, category_id)
);

-- RLS: категории — свои. Связки — если рецепт принадлежит пользователю.
alter table public.categories enable row level security;
drop policy if exists categories_own on public.categories;
create policy categories_own on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.recipe_categories enable row level security;

drop policy if exists rc_select on public.recipe_categories;
create policy rc_select on public.recipe_categories for select
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

drop policy if exists rc_insert on public.recipe_categories;
create policy rc_insert on public.recipe_categories for insert
  with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
    and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  );

drop policy if exists rc_delete on public.recipe_categories;
create policy rc_delete on public.recipe_categories for delete
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- Посев дефолтных категорий для нового пользователя.
create or replace function public.seed_default_categories()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.categories (user_id, name)
  values (new.id, 'Супы'), (new.id, 'Салаты'), (new.id, 'Основные блюда'), (new.id, 'Десерты')
  on conflict (user_id, name) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.seed_default_categories();

-- Разовый посев для уже существующих пользователей, у кого категорий ещё нет.
insert into public.categories (user_id, name)
select u.id, c.name
from auth.users u
cross join (values ('Супы'), ('Салаты'), ('Основные блюда'), ('Десерты')) as c(name)
where not exists (select 1 from public.categories cat where cat.user_id = u.id)
on conflict (user_id, name) do nothing;
