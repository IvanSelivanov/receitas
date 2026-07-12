import { describe, it, expect } from 'vitest';
import { parseVoiceCommand } from './voice';

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

  it('таймер важнее навигации при конфликте слов', () => {
    // «дальше» есть, но это про таймер
    expect(parseVoiceCommand('таймер на 3 минуты')).toEqual({ type: 'timer', minutes: 3 });
  });

  it('пустое/непонятное -> null', () => {
    expect(parseVoiceCommand('')).toBeNull();
    expect(parseVoiceCommand('бла бла бла')).toBeNull();
  });
});
