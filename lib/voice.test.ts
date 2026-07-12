import { describe, it, expect } from 'vitest';
import { parseVoiceCommand, speakableQuantity, expandForSpeech } from './voice';
import { parseQuantity } from './recipe/scale';

describe('speakableQuantity', () => {
  it('раскрывает сокращения с согласованием', () => {
    expect(speakableQuantity(parseQuantity('1 ч. л.'))).toBe('1 чайная ложка');
    expect(speakableQuantity(parseQuantity('2 ст. л.'))).toBe('2 столовые ложки');
    expect(speakableQuantity(parseQuantity('5 ст. л.'))).toBe('5 столовых ложек');
    expect(speakableQuantity(parseQuantity('50 г'))).toBe('50 граммов');
    expect(speakableQuantity(parseQuantity('3 шт.'))).toBe('3 штуки');
  });
  it('диапазон', () => {
    expect(speakableQuantity(parseQuantity('50–70 г'))).toBe('от 50 до 70 граммов');
  });
  it('нечисловое — как есть', () => {
    expect(speakableQuantity(parseQuantity('по вкусу'))).toBe('по вкусу');
  });
  it('незнакомая единица — как есть', () => {
    expect(speakableQuantity(parseQuantity('1 стакан'))).toBe('1 стакан');
  });
});

describe('expandForSpeech', () => {
  it('раскрывает сокращения в тексте', () => {
    expect(expandForSpeech('добавьте 2 ст. л. масла')).toContain('столовых ложек');
    expect(expandForSpeech('1 ч. л. соли')).toContain('чайных ложек');
    expect(expandForSpeech('духовку 180°C')).toContain('180 градусов');
    expect(expandForSpeech('500 г муки')).toContain('500 граммов');
  });
  it('не трогает обычные слова с буквой г', () => {
    expect(expandForSpeech('город огонь')).toBe('город огонь');
  });
});

describe('parseVoiceCommand', () => {
  it('навигация вперёд', () => {
    expect(parseVoiceCommand('дальше')).toEqual({ type: 'next' });
    expect(parseVoiceCommand('следующий шаг')).toEqual({ type: 'next' });
    expect(parseVoiceCommand('вперёд')).toEqual({ type: 'next' });
  });

  it('навигация назад', () => {
    expect(parseVoiceCommand('назад')).toEqual({ type: 'prev' });
    expect(parseVoiceCommand('предыдущий')).toEqual({ type: 'prev' });
  });

  it('повтор/чтение', () => {
    expect(parseVoiceCommand('повтори')).toEqual({ type: 'read' });
    expect(parseVoiceCommand('прочитай ещё раз')).toEqual({ type: 'read' });
  });

  it('таймер числом', () => {
    expect(parseVoiceCommand('поставь таймер на 10 минут')).toEqual({ type: 'timer', minutes: 10 });
    expect(parseVoiceCommand('таймер 5 минут')).toEqual({ type: 'timer', minutes: 5 });
  });

  it('таймер словом', () => {
    expect(parseVoiceCommand('засеки пять минут')).toEqual({ type: 'timer', minutes: 5 });
    expect(parseVoiceCommand('таймер на двадцать минут')).toEqual({ type: 'timer', minutes: 20 });
    expect(parseVoiceCommand('таймер на минутку')).toEqual({ type: 'timer', minutes: 1 });
  });

  it('составное число — двадцать пять раньше двадцати', () => {
    expect(parseVoiceCommand('таймер двадцать пять минут')).toEqual({ type: 'timer', minutes: 25 });
  });

  it('стоп таймера', () => {
    expect(parseVoiceCommand('стоп')).toEqual({ type: 'stopTimer' });
    expect(parseVoiceCommand('останови таймер')).toEqual({ type: 'stopTimer' });
  });

  it('выход', () => {
    expect(parseVoiceCommand('закрой')).toEqual({ type: 'exit' });
  });

  it('ингредиенты', () => {
    expect(parseVoiceCommand('ингредиенты')).toEqual({ type: 'ingredients' });
    expect(parseVoiceCommand('что нужно')).toEqual({ type: 'ingredients' });
    expect(parseVoiceCommand('прочитай ингредиенты')).toEqual({ type: 'ingredients' });
  });

  it('таймер важнее навигации при конфликте слов', () => {
    // «дальше» есть, но это про таймер
    expect(parseVoiceCommand('таймер на 3 минуты')).toEqual({ type: 'timer', minutes: 3 });
  });

  it('пустое/непонятное -> null', () => {
    expect(parseVoiceCommand('')).toBeNull();
    expect(parseVoiceCommand('бла бла бла')).toBeNull();
  });
});
