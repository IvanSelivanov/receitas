'use client';

import { useEffect, useRef, useState } from 'react';
import { formatQuantity } from '@/lib/recipe/scale';
import { parseVoiceCommand, speakableQuantity, expandForSpeech, type VoiceCommand } from '@/lib/voice';
import type { StoredStep } from '@/lib/schema';

// Минимальные типы Web Speech API (не всегда есть в lib.dom).
interface SREvent {
  results: { length: number; [i: number]: { 0: { transcript: string } } };
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SRCtor = new () => SRInstance;

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const firedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<SRInstance | null>(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const speakTokenRef = useRef(0);
  const dispatchRef = useRef<(c: VoiceCommand) => void>(() => {});

  function toggleListening() {
    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      setHeard('');
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setHeard('Распознавание речи не поддерживается в этом браузере');
      return;
    }
    const rec = new Ctor();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript ?? '';
      setHeard(text);
      const cmd = parseVoiceCommand(text);
      if (cmd) dispatchRef.current(cmd);
    };
    rec.onend = () => {
      // Web Speech сам останавливается после паузы — перезапускаем, пока включено
      // и пока не идёт озвучка (иначе распознавание услышит собственное чтение).
      if (listeningRef.current && !speakingRef.current) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    rec.onerror = () => {};
    recognitionRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    setHeard('Слушаю…');
    try {
      rec.start();
    } catch {
      /* ignore */
    }
  }

  function speak(text: string, uri = voiceURI) {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    const token = ++speakTokenRef.current;
    synth.cancel();
    // Пауза микрофона на время речи (иначе распознаётся собственное чтение).
    speakingRef.current = true;
    if (listeningRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    const v = synth.getVoices().find((x) => x.voiceURI === uri);
    if (v) u.voice = v;
    const resume = () => {
      if (token !== speakTokenRef.current) return; // устаревшая реплика — игнор
      speakingRef.current = false;
      if (listeningRef.current) {
        try {
          recognitionRef.current?.start();
        } catch {
          /* ignore */
        }
      }
    };
    u.onend = resume;
    u.onerror = resume;
    synth.speak(u);
  }
  function selectVoice(uri: string) {
    setVoiceURI(uri);
    try {
      localStorage.setItem('tts-voice', uri);
    } catch {
      /* ignore */
    }
    speak('Пример голоса', uri); // образец сразу новым голосом
  }
  function readStep(step: StoredStep) {
    speak(expandForSpeech([step.label, step.text].filter(Boolean).join('. ')));
  }
  // Озвучивает ингредиенты ТЕКУЩЕГО шага (с раскрытием сокращений в количествах).
  function readStepIngredients() {
    const uses = steps[i]?.uses ?? [];
    const parts = uses.map((u) => {
      const q = u.quantity ? speakableQuantity(u.quantity) : u.note ?? '';
      return q ? `${u.ingredientName}, ${q}` : u.ingredientName;
    });
    speak(parts.length ? parts.join('. ') : 'Для этого шага ингредиенты не указаны');
  }
  // Переход к шагу n (+ озвучка, если включена).
  function go(n: number) {
    const idx = Math.max(0, Math.min(steps.length - 1, n));
    setI(idx);
    if (autoSpeak) readStep(steps[idx]);
  }

  // Останавливаем речь и распознавание при выходе.
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      listeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  // Список голосов грузится асинхронно (иногда с задержкой). Показываем ВСЕ
  // доступные голоса, русские — первыми.
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => {
      const all = synth.getVoices();
      if (all.length === 0) return;
      const sorted = [...all].sort((a, b) => {
        const ar = a.lang.toLowerCase().startsWith('ru') ? 0 : 1;
        const br = b.lang.toLowerCase().startsWith('ru') ? 0 : 1;
        return ar - br || a.name.localeCompare(b.name);
      });
      setVoices(sorted);
    };
    load();
    synth.addEventListener?.('voiceschanged', load);
    const t = setTimeout(load, 300); // фолбэк на браузеры с задержкой
    try {
      const saved = localStorage.getItem('tts-voice');
      if (saved) setVoiceURI(saved);
    } catch {
      /* ignore */
    }
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      clearTimeout(t);
    };
  }, []);

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

  // Диспетчер голосовых команд (обновляем каждый рендер, чтобы видеть свежие i/step).
  dispatchRef.current = (cmd: VoiceCommand) => {
    switch (cmd.type) {
      case 'next':
        go(i + 1);
        break;
      case 'prev':
        go(i - 1);
        break;
      case 'read':
        readStep(step);
        break;
      case 'ingredients':
        readStepIngredients();
        break;
      case 'timer':
        startTimer(cmd.minutes, `${step.label || `Шаг ${i + 1}`}: ${cmd.minutes} мин`);
        break;
      case 'stopTimer':
        setTimer(null);
        break;
      case 'exit':
        onExit();
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">{title}</span>
        <span className="shrink-0 text-sm tabular-nums text-neutral-500">
          Шаг {i + 1} / {total}
        </span>
        <button
          onClick={toggleListening}
          aria-label="Голосовые команды"
          title="Голосовые команды"
          className={`shrink-0 text-base ${listening ? 'animate-pulse' : 'opacity-40'}`}
        >
          🎤
        </button>
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

      {heard && (
        <div className="bg-neutral-100 px-4 py-1.5 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          {listening
            ? `🎤 ${heard} · «дальше» · «назад» · «повтори» · «ингредиенты» · «таймер N минут» · «стоп»`
            : heard}
        </div>
      )}

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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => readStep(step)} className="text-sm text-neutral-500 hover:underline">
            🔊 Прочитать шаг
          </button>
          <button onClick={readStepIngredients} className="text-sm text-neutral-500 hover:underline">
            🔊 Ингредиенты шага
          </button>
          {voices.length > 1 && (
            <select
              value={voiceURI}
              onChange={(e) => selectVoice(e.target.value)}
              aria-label="Голос озвучки"
              className="max-w-[12rem] rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-sm text-neutral-600 outline-none dark:border-neutral-700 dark:text-neutral-300"
            >
              <option value="">Голос по умолчанию</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}
        </div>

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
