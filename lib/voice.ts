// Разбор голосовой команды в действие. Чистая функция — тестируема без микрофона.
export type VoiceCommand =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'read' }
  | { type: 'ingredients' }
  | { type: 'stopTimer' }
  | { type: 'exit' }
  | { type: 'timer'; minutes: number };

// Числа словами (частые для таймеров). Длинные фразы проверяем первыми.
const NUM_WORDS: [string, number][] = [
  ['сорок пять', 45],
  ['двадцать пять', 25],
  ['полторы', 1.5],
  ['одну', 1],
  ['одна', 1],
  ['один', 1],
  ['две', 2],
  ['два', 2],
  ['три', 3],
  ['четыре', 4],
  ['пять', 5],
  ['шесть', 6],
  ['семь', 7],
  ['восемь', 8],
  ['девять', 9],
  ['десять', 10],
  ['двенадцать', 12],
  ['пятнадцать', 15],
  ['двадцать', 20],
  ['тридцать', 30],
  ['сорок', 40],
  ['пятьдесят', 50],
  ['шестьдесят', 60],
];

function extractMinutes(t: string): number | null {
  const digit = t.match(/(\d+(?:[.,]\d+)?)/);
  if (digit) {
    const n = parseFloat(digit[1].replace(',', '.'));
    if (n > 0) return n;
  }
  // От длинных к коротким, чтобы «двадцать» не поймалось как «два».
  for (const [word, n] of [...NUM_WORDS].sort((a, b) => b[0].length - a[0].length)) {
    if (t.includes(word)) return n;
  }
  if (/минутку|минуту/.test(t)) return 1; // «на минуту / минутку»
  return null;
}

export function parseVoiceCommand(raw: string): VoiceCommand | null {
  const t = raw.toLowerCase().trim();
  if (!t) return null;

  // Таймер — раньше остального (чтобы «таймер две минуты» не спутать с навигацией).
  if (/таймер|засек|минут/.test(t)) {
    const minutes = extractMinutes(t);
    if (minutes != null) return { type: 'timer', minutes };
  }
  if (/(ингредиент|что нужно|состав|продукты)/.test(t)) return { type: 'ingredients' };
  if (/(стоп|останов|сброс|отмен)/.test(t)) return { type: 'stopTimer' };
  if (/(дальше|вперёд|вперед|следующ|далее)/.test(t)) return { type: 'next' };
  if (/(назад|предыдущ|обратно|вернись)/.test(t)) return { type: 'prev' };
  if (/(повтори|прочит|ещё раз|еще раз|заново)/.test(t)) return { type: 'read' };
  if (/(выход|закрой|заверши|готово)/.test(t)) return { type: 'exit' };
  return null;
}
