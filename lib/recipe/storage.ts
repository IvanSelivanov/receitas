import type { SupabaseClient } from '@supabase/supabase-js';

export const PHOTO_BUCKET = 'recipe-photos';

// Загружает фото в Storage по пути {userId}/{recipeId}/{key}.jpg и возвращает
// публичный URL. upsert:true — повторная загрузка заменяет файл; ?v= для сброса
// кэша браузера (путь тот же). key: 'main' | 'step-<i>'.
export async function uploadPhoto(
  sb: SupabaseClient,
  userId: string,
  recipeId: string,
  key: string,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/${recipeId}/${key}.jpg`;
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
  });
  if (error) throw error;

  const { data } = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
