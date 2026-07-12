'use client';

import { useEffect, useRef, useState } from 'react';
import { formatQuantity } from '@/lib/recipe/scale';
import type { StoredStep } from '@/lib/schema';

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Три коротких бипа на УЖЕ разблокированном контексте (разблокировка — на тапе
// «запустить таймер», иначе iOS Safari звук глушит). Мягкая атака/затухание.
function playBeeps(ctx: AudioContext) {
  for (const offset of [0, 0.35, 0.7]) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      const start = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      osc.start(start);
      osc.stop(start + 0.26);
    } catch {
      /* ignore */
    }
  }
}

type WakeSentinel = { release: () => Promise<void> };
type WakeNavigator = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeSentinel> } };

// Полноэкранный пошаговый режим готовки.
export function CookMode({
  steps,
  title,
  onExit,
}: {
  steps: StoredStep[];
  title: string;
  onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const [timer, setTimer] = useState<{ endAt: number; label: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [extendMin, setExtendMin] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const firedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  function speak(text: string) {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    synth.speak(u);
  }
  function readStep(step: StoredStep) {
    speak([step.label, step.text].filter(Boolean).join('. '));
  }
  // Переход к шагу n (+ озвучка, если включена).
  function go(n: number) {
    const idx = Math.max(0, Math.min(steps.length - 1, n));
    setI(idx);
    if (autoSpeak) readStep(steps[idx]);
  }

  // Останавливаем речь при выходе.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function ensureAudio(): AudioContext | null {
    if (!audioRef.current) {
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      } catch {
        /* нет поддержки — ок */
      }
    }
    return audioRef.current;
  }

  // Разблокировка звука внутри пользовательского жеста (тап по кнопке таймера).
  // Без этого iOS не даст проиграть звук из колбэка таймера позже.
  function unlockAudio() {
    const ctx = ensureAudio();
    if (!ctx) return;
    ctx.resume().catch(() => {});
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  function playAlert() {
    const ctx = ensureAudio();
    if (ctx) {
      ctx.resume().catch(() => {});
      playBeeps(ctx);
    }
    // Вибрация — на Android работает, на iOS Safari игнорируется (не поддержано).
    try {
      navigator.vibrate?.([300, 150, 300, 150, 300]);
    } catch {
      /* ignore */
    }
  }

  const remaining = timer ? Math.max(0, Math.round((timer.endAt - now) / 1000)) : 0;

  // Тикаем, пока таймер активен.
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timer]);

  // Сигнал ровно один раз при достижении нуля.
  useEffect(() => {
    if (timer && remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      playAlert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, remaining]);

  // Закрываем аудио-контекст при выходе из режима готовки.
  useEffect(() => {
    return () => {
      audioRef.current?.close().catch(() => {});
    };
  }, []);

  // Не давать экрану гаснуть (и переполучать блокировку при возврате во вкладку).
  useEffect(() => {
    let sentinel: WakeSentinel | null = null;
    const request = async () => {
      try {
        sentinel = (await (navigator as WakeNavigator).wakeLock?.request('screen')) ?? null;
      } catch {
        /* не поддерживается — ок */
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, []);

  function startTimer(minutes: number, label: string) {
    unlockAudio(); // вызывается из тапа -> разблокирует звук для iOS
    firedRef.current = false;
    setNow(Date.now());
    setTimer({ endAt: Date.now() + minutes * 60_000, label });
  }

  // Продлить закончившийся таймер на введённое число минут (с текущего момента).
  function extend() {
    const m = parseFloat(extendMin.replace(',', '.'));
    if (!timer || !Number.isFinite(m) || m <= 0) return;
    startTimer(m, timer.label);
    setExtendMin('');
  }

  const step = steps[i];
  const total = steps.length;
  const progress = total > 0 ? ((i + 1) / total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">{title}</span>
        <span className="shrink-0 text-sm tabular-nums text-neutral-500">
          Шаг {i + 1} / {total}
        </span>
        <button
          onClick={() => {
            const next = !autoSpeak;
            setAutoSpeak(next);
            if (next) readStep(step);
            else window.speechSynthesis?.cancel();
          }}
          aria-label="Автоозвучка шагов"
          title="Автоозвучка шагов при переходе"
          className={`shrink-0 text-base ${autoSpeak ? '' : 'opacity-40'}`}
        >
          🔊
        </button>
        <button onClick={onExit} aria-label="Закрыть" className="shrink-0 text-neutral-500">
          ✕
        </button>
      </div>
      <div className="h-1 bg-neutral-100 dark:bg-neutral-900">
        <div className="h-full bg-neutral-900 transition-all dark:bg-white" style={{ width: `${progress}%` }} />
      </div>

      {timer && (
        <div
          className={`flex items-center gap-3 px-4 py-2.5 ${
            remaining === 0 ? 'bg-green-600 text-white' : 'bg-neutral-100 dark:bg-neutral-900'
          }`}
        >
          <span className="min-w-0 flex-1 truncate text-sm">{timer.label}</span>
          {remaining === 0 ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-semibold">Готово!</span>
              <input
                inputMode="decimal"
                value={extendMin}
                onChange={(e) => setExtendMin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') extend();
                }}
                placeholder="мин"
                className="w-14 rounded border-0 bg-white px-2 py-1 text-center text-sm text-neutral-900 outline-none"
              />
              <button
                onClick={extend}
                disabled={!extendMin.trim()}
                className="rounded bg-white/25 px-2 py-1 text-sm font-medium disabled:opacity-50"
              >
                + продлить
              </button>
              <button onClick={() => setTimer(null)} className="text-sm underline">
                закрыть
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-lg font-semibold tabular-nums">{mmss(remaining)}</span>
              <button onClick={() => setTimer(null)} className="text-sm underline">
                стоп
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {step.label && <p className="mb-2 text-lg font-semibold text-neutral-500">{step.label}</p>}
        <p className="text-2xl leading-relaxed">{step.text}</p>
        <button
          onClick={() => readStep(step)}
          className="mt-3 text-sm text-neutral-500 hover:underline"
        >
          🔊 Прочитать шаг
        </button>

        {step.uses.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {step.uses.map((u, ui) => (
              <span
                key={ui}
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-base dark:bg-neutral-800"
              >
                {u.ingredientName}
                {u.quantity ? ` · ${formatQuantity(u.quantity)}` : u.note ? ` · ${u.note}` : ''}
              </span>
            ))}
          </div>
        )}

        {step.timers.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {step.timers.map((t, ti) => {
              const label = t.minMin === t.maxMin ? `${t.minMin}` : `${t.minMin}–${t.maxMin}`;
              return (
                <button
                  key={ti}
                  onClick={() =>
                    startTimer(t.minMin, `${step.label || `Шаг ${i + 1}`}: ${label} мин`)
                  }
                  className="rounded-lg border border-neutral-300 px-4 py-2.5 text-base dark:border-neutral-700"
                >
                  ▶ Таймер {label} мин
                </button>
              );
            })}
          </div>
        )}

        {step.temperatureC != null && (
          <p className="mt-4 text-base text-neutral-500">Температура: {step.temperatureC}°C</p>
        )}
      </div>

      <div className="flex gap-3 border-t border-neutral-200 p-4 dark:border-neutral-800">
        <button
          disabled={i === 0}
          onClick={() => go(i - 1)}
          className="flex-1 rounded-lg border border-neutral-300 py-3 text-base disabled:opacity-40 dark:border-neutral-700"
        >
          Назад
        </button>
        {i < total - 1 ? (
          <button
            onClick={() => go(i + 1)}
            className="flex-[2] rounded-lg bg-neutral-900 py-3 text-base font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Далее
          </button>
        ) : (
          <button
            onClick={onExit}
            className="flex-[2] rounded-lg bg-green-600 py-3 text-base font-medium text-white"
          >
            Готово
          </button>
        )}
      </div>
    </div>
  );
}
