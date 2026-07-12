-- Хранилище фото рецептов. Применить в Supabase → SQL Editor → Run.
-- Путь файла: {user_id}/{recipe_id}/{main|step-N}.jpg
-- Бакет публичный на чтение (фото блюд не секретны), запись/удаление — только в
-- свою папку ((storage.foldername(name))[1] = auth.uid()).

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

drop policy if exists "recipe_photos_read" on storage.objects;
create policy "recipe_photos_read" on storage.objects
  for select using (bucket_id = 'recipe-photos');

drop policy if exists "recipe_photos_insert" on storage.objects;
create policy "recipe_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recipe_photos_update" on storage.objects;
create policy "recipe_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recipe_photos_delete" on storage.objects;
create policy "recipe_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
