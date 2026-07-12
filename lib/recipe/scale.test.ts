import { describe, it, expect } from 'vitest';
import { parseQuantity, scaleQuantity, formatQuantity, type Quantity } from './scale';

describe('parseQuantity', () => {
  it('парсит целое число с единицей', () => {
    expect(parseQuantity('5 ст. л.')).toMatchObject({ kind: 'number', value: 5, unit: 'ст. л.' });
  });

  it('парсит диапазон через дефис', () => {
    expect(parseQuantity('6-8 шт.')).toMatchObject({ kind: 'range', min: 6, max: 8, unit: 'шт.' });
  });

  it('парсит диапазон через en-dash (как в examples/)', () => {
    expect(parseQuantity('50–70 г')).toMatchObject({ kind: 'range', min: 50, max: 70, unit: 'г' });
  });

  it('парсит дробь 1/2', () => {
    expect(parseQuantity('1/2 стакана')).toMatchObject({ kind: 'number', value: 0.5, unit: 'стакана' });
  });

  it('парсит десятичную с запятой (русский формат)', () => {
    expect(parseQuantity('1,5 ст. л.')).toMatchObject({ kind: 'number', value: 1.5, unit: 'ст. л.' });
  });

  it('нечисловое количество -> text', () => {
    expect(parseQuantity('по вкусу')).toEqual({ kind: 'text', raw: 'по вкусу' });
    expect(parseQuantity('для жарки')).toMatchObject({ kind: 'text' });
    expect(parseQuantity('горсть')).toMatchObject({ kind: 'text' });
  });

  it('число без единицы', () => {
    expect(parseQuantity('3')).toMatchObject({ kind: 'number', value: 3, unit: null });
  });

  it('пустая строка -> text, не падает', () => {
    expect(parseQuantity('')).toMatchObject({ kind: 'text' });
  });

  it('деление на ноль не ломает парсер', () => {
    expect(parseQuantity('1/0 стакана')).toMatchObject({ kind: 'text' });
  });
});

describe('scaleQuantity', () => {
  it('удваивает число', () => {
    const q = parseQuantity('5 ст. л.');
    expect(scaleQuantity(q, 2)).toMatchObject({ kind: 'number', value: 10, unit: 'ст. л.' });
  });

  it('половинит число', () => {
    const q = parseQuantity('1 шт.');
    expect(scaleQuantity(q, 0.5)).toMatchObject({ kind: 'number', value: 0.5 });
  });

  it('масштабирует диапазон x2 (50–70 -> 100–140)', () => {
    const q = parseQuantity('50–70 г');
    expect(scaleQuantity(q, 2)).toMatchObject({ kind: 'range', min: 100, max: 140 });
  });

  it('масштабирует диапазон x1.5', () => {
    const q = parseQuantity('6-8 шт.');
    expect(scaleQuantity(q, 1.5)).toMatchObject({ kind: 'range', min: 9, max: 12 });
  });

  it('не трогает текстовое количество', () => {
    const q: Quantity = { kind: 'text', raw: 'по вкусу' };
    expect(scaleQuantity(q, 3)).toEqual(q);
  });

  it('округляет некрасивые дроби до 2 знаков', () => {
    const q = parseQuantity('10 г');
    // 10 / 3 = 3.333... -> 3.33
    expect(scaleQuantity(q, 1 / 3)).toMatchObject({ value: 3.33 });
  });

  it('x1 не меняет значение', () => {
    const q = parseQuantity('200 мл');
    expect(scaleQuantity(q, 1)).toMatchObject({ value: 200 });
  });
});

describe('formatQuantity', () => {
  it('число с единицей', () => {
    expect(formatQuantity({ kind: 'number', value: 10, unit: 'ст. л.', raw: '' })).toBe('10 ст. л.');
  });

  it('диапазон с единицей использует en-dash', () => {
    expect(formatQuantity({ kind: 'range', min: 100, max: 140, unit: 'г', raw: '' })).toBe('100–140 г');
  });

  it('число без единицы', () => {
    expect(formatQuantity({ kind: 'number', value: 3, unit: null, raw: '' })).toBe('3');
  });

  it('текст возвращается как есть', () => {
    expect(formatQuantity({ kind: 'text', raw: 'по вкусу' })).toBe('по вкусу');
  });

  it('round-trip: parse -> scale -> format', () => {
    expect(formatQuantity(scaleQuantity(parseQuantity('50–70 г'), 2))).toBe('100–140 г');
  });
});
