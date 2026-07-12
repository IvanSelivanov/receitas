// Сжатие изображения на клиенте перед загрузкой (решение Eng Review): ужимаем
// до maxDim по большей стороне и пережимаем в JPEG. Экономит квоту Storage и
// трафик. EXIF-ориентация применяется (imageOrientation: 'from-image').
export async function compressImage(file: File, maxDim = 1280, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сжать изображение'))),
      'image/jpeg',
      quality,
    );
  });
}
