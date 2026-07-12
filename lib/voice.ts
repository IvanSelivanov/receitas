import type { Quantity } from './recipe/scale';

// Русское согласование числительного: 1 грамм, 2 грамма, 5 граммов.
function plural(n: number, one: string, few: string, many: string): string {
  const nn = Math.abs(Math.round(n)) % 100;
  const n1 = nn % 10;
  if (nn > 10 && nn < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

// Единицы -> произносимые формы [1, 2-4, 5+].
const UNIT_FORMS: Record<string, [string, string, string]> = {
  г: ['грамм', 'грамма', 'граммов'],
  кг: ['килограмм', 'килограмма', 'килограммов'],
  мл: ['миллилитр', 'миллилитра', 'миллилитров'],
  л: ['литр', 'литра', 'литров'],
  см: ['сантиметр', 'сантиметра', 'сантиметров'],
  стл: ['столовая ложка', 'столовые ложки', 'столовых ложек'],
  чл: ['чайная ложка', 'чайные ложки', 'чайных ложек'],
  шт: ['штука', 'штуки', 'штук'],
  зуб: ['зубчик', 'зубчика', 'зубчиков'],
  зубчик: ['зубчик', 'зубчика', 'зубчиков'],
  зубчика: ['зубчик', 'зубчика', 'зубчиков'],
  зубчиков: ['зубчик', 'зубчика', 'зубчиков'],
};

const unitKey = (u: string | null) => (u ?? '').toLowerCase().replace(/[.\s]/g, '');
const numStr = (n: number) => String(Math.round(n * 100) / 100);

/** Произносимая форма количества: раскрывает сокращения (1 ч. л. -> одна чайная ложка). */
export function speakableQuantity(q: Quantity): string {
  if (q.kind === 'text') return q.raw;
  if (q.kind === 'number') {
    const forms = UNIT_FORMS[unitKey(q.unit)];
    return `${numStr(q.value)} ${forms ? plural(q.value, ...forms) : q.unit ?? ''}`.trim();
  }
  const forms = UNIT_FORMS[unitKey(q.unit)];
  return `от ${numStr(q.min)} до ${numStr(q.max)} ${forms ? plural(q.max, ...forms) : q.unit ?? ''}`.trim();
}

/** Раскрывает частые сокращения в свободном тексте для озвучки (грубое согласование). */
export function expandForSpeech(text: string): string {
  return text
    .replace(/(\d)\s*ст\.?\s*л\.?/gi, '$1 столовых ложек')
    .replace(/(\d)\s*ч\.?\s*л\.?/gi, '$1 чайных ложек')
    .replace(/(\d)\s*мл/gi, '$1 миллилитров')
    .replace(/(\d)\s*кг/gi, '$1 килограммов')
    .replace(/(\d)\s*г(?![а-яё])/gi, '$1 граммов')
    .replace(/\s*°\s*c/gi, ' градусов');
}

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
