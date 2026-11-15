"use client";

import { ArrowUp, ArrowUpRight, MessageCircleQuestion, Minus, MousePointer2, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AssistantPointer, PageAssistantAnswer } from "../../core/si-engine/page-assistant";
import { VoiceCaptions, type SpeechClock } from "./VoiceCaptions";
import styles from "./EvidenceAssistant.module.css";

export interface AssistantConversationContext {
  history: { question: string; answer: string }[];
  previousSelection?: AssistantPointer["selection"];
}

interface EvidenceAssistantProps {
  onAsk: (question: string, context: AssistantConversationContext) => PageAssistantAnswer | Promise<PageAssistantAnswer>;
  onNavigate: (pointer: AssistantPointer) => void;
  onProgress?: (answer: PageAssistantAnswer, count: number) => void;
  onClear?: () => void;
  side?: "left" | "right";
  speechEnabled: boolean;
}

interface Turn {
  question: string;
  answer?: PageAssistantAnswer;
}

const examples = [
  "¿Qué fue Saffire-VI y cuándo ocurrió?",
  "¿Qué cambió entre A y B?",
  "¿Dónde cambio el oxígeno?",
];

const unavailable: PageAssistantAnswer = {
  text: "No pude preparar una respuesta. Prueba con el nombre de un estudio o de una sección de la consola.",
  pointers: [],
};

type ReadingClock =
  | { startMs: number; offset: number }
  | SpeechClock;

function WrittenReply({ text, animate, clock, onProgress }: {
  text: string; animate: boolean; clock: ReadingClock | null; onProgress: (count: number) => void;
}) {
  const [count, setCount] = useState(0);
  const report = useEffectEvent(onProgress);
  useEffect(() => {
    if (!animate || !clock) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = Math.min(11_000, Math.max(550, text.length * 12));
    let frame = 0;
    let revealed = "offset" in clock ? clock.offset : 0;
    const tick = (now: number) => {
      if ("audio" in clock) {
        const elapsed = Math.max(0, clock.audio.currentTime - clock.startSeconds);
        if (elapsed >= clock.duration) revealed = text.length;
        else if (clock.ends.length === text.length) {
          while (revealed < clock.ends.length && clock.ends[revealed] <= elapsed) revealed += 1;
        } else revealed = Math.min(text.length, Math.floor(text.length * elapsed / clock.duration));
      } else {
        revealed = Math.min(text.length, clock.offset + Math.floor(text.length * (now - clock.startMs) / duration));
      }
      setCount(reduced ? text.length : revealed);
      report(revealed);
      if (revealed < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, animate, clock]);

  const visible = animate ? count : text.length;
  return <p>
    <span className="sr-only">Respuesta: {text}</span>
    <span aria-hidden="true">{animate && !clock ? "Preparando la lectura…" : text.slice(0, visible)}
      {visible < text.length && <span className={styles.caret} />}</span>
  </p>;
}

function AssistantReply({ answer, onNavigate, animate, clock, onProgress }: {
  answer: PageAssistantAnswer | undefined;
  onNavigate: (pointer: AssistantPointer) => void;
  animate: boolean;
  clock: ReadingClock | null;
  onProgress: (answer: PageAssistantAnswer, count: number) => void;
}) {
  if (!answer) {
    return (
      <p className={styles.waiting}>
        <span className={styles.waitingDots} aria-hidden="true"><i /><i /><i /></span>
        Preparando la respuesta…
      </p>
    );
  }

  const sources = new Map(answer.sources?.map((source) => [source.url, source]));
  for (const { source } of answer.pointers) {
    if (source && !sources.has(source.url)) sources.set(source.url, source);
  }

  return (
    <div className={styles.reply} data-assistant-reply>
      {answer.origin && <span className={styles.origin}>{answer.origin === "ai" ? "Respuesta con IA" : "Respuesta local"}</span>}
      <WrittenReply text={answer.text} animate={animate} clock={clock} onProgress={(count) => onProgress(answer, count)} />
      {answer.pointers.length > 0 && <ul className={styles.pointers}>
        {answer.pointers.map((pointer, index) => <li key={`${pointer.target}:${pointer.selection?.id ?? ""}:${index}`}>
          <button type="button" onClick={() => onNavigate(pointer)}>
            <MousePointer2 size={13} aria-hidden="true" /> {pointer.label}
          </button>
        </li>)}
      </ul>}
      {sources.size > 0 && <ul className={styles.sources} aria-label="Fuentes de la respuesta">
        {Array.from(sources.values(), (source) => <li key={source.url}>
          <a href={source.url} target="_blank" rel="noreferrer">
            <ArrowUpRight size={13} aria-hidden="true" /> {source.label}
          </a>
        </li>)}
      </ul>}
    </div>
  );
}

export function EvidenceAssistant({ onAsk, onNavigate, onProgress, onClear, side = "right", speechEnabled }: EvidenceAssistantProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [restored, setRestored] = useState(false);
  const [animatedTurn, setAnimatedTurn] = useState<number | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [readingClock, setReadingClock] = useState<ReadingClock | null>(null);
  const [captionClock, setCaptionClock] = useState<SpeechClock | null>(null);
  const shownChars = useRef(0);
  const voiceActive = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const speechSource = useRef<AudioBufferSourceNode | null>(null);
  const previousError = useRef(false);
  const speechRequest = useRef<AbortController | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const speechFocus = useRef<{ restore: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();
  const previousTurn = turns.at(-1);
  const pending = previousTurn !== undefined && previousTurn.answer === undefined;
  const speaking = voiceStatus === "Leyendo respuesta";
  const drawerOpen = open && !speaking;

  useEffect(() => () => {
    speechRequest.current?.abort();
    if (audioContext.current) void audioContext.current.close().catch(() => {});
  }, []);

  function stopVoice() {
    speechRequest.current?.abort();
    const source = speechSource.current;
    speechSource.current = null;
    source?.stop();
    setVoiceStatus("");
  }

  async function speak(answer: PageAssistantAnswer) {
    const failed = answer === unavailable || answer.unanswered === true;
    const repeatedError = failed && previousError.current;
    previousError.current = failed;
    const context = audioContext.current;
    if (!voiceActive.current || !context || repeatedError) {
      setReadingClock({ startMs: performance.now(), offset: 0 });
      return;
    }
    stopVoice();
    const controller = new AbortController();
    speechRequest.current = controller;
    setVoiceStatus("Preparando la voz");
    try {
      const response = await fetch("/api/assistant/speech", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer.text, includeTimings: true }), signal: controller.signal,
      });
      if (!response.ok) throw new Error("Audio no disponible");
      const { audioBase64, characterEndTimesSeconds, captionText, captionStartTimesSeconds, captionEndTimesSeconds } = await response.json();
      const bytes = Uint8Array.from(atob(audioBase64), (character) => character.charCodeAt(0));
      const buffer = await context.decodeAudioData(bytes.buffer);
      if (controller.signal.aborted) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (speechSource.current === source) {
          speechSource.current = null;
          setVoiceStatus("");
          setOpen(true);
        }
      };
      const startSeconds = context.currentTime + 0.04;
      source.start(startSeconds);
      speechSource.current = source;
      const clock: SpeechClock = {
        audio: context, startSeconds, duration: buffer.duration, ends: characterEndTimesSeconds,
        spokenText: captionText ?? answer.text, spokenStarts: captionStartTimesSeconds ?? [],
        spokenEnds: captionEndTimesSeconds ?? characterEndTimesSeconds,
      };
      speechFocus.current = { restore: drawerRef.current?.contains(document.activeElement) ?? false };
      if (speechFocus.current.restore) launcherRef.current?.focus({ preventScroll: true });
      setReadingClock(clock);
      setCaptionClock(clock);
      setVoiceStatus("Leyendo respuesta");
    } catch {
      if (!controller.signal.aborted) {
        setVoiceStatus("Voz no disponible");
        setReadingClock({ startMs: performance.now(), offset: shownChars.current });
      }
    }
  }

  function toggleVoice() {
    const enabled = !voiceActive.current;
    voiceActive.current = enabled;
    setVoiceOn(enabled);
    if (enabled) {
      audioContext.current ??= new AudioContext();
      void audioContext.current.resume().catch(() => {});
    } else {
      stopVoice();
      setReadingClock({ startMs: performance.now(), offset: shownChars.current });
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("aether-assistant-history") ?? "[]");
      if (Array.isArray(saved)) setTurns(saved.filter((turn) => typeof turn?.question === "string" &&
        typeof turn?.answer?.text === "string" && Array.isArray(turn.answer.pointers)));
    } catch {
      // El chat sigue disponible si el navegador bloquea el almacenamiento.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem("aether-assistant-history", JSON.stringify(turns.filter(({ answer }) => answer)));
    } catch {
      // Se conserva la conversación en memoria.
    }
  }, [restored, turns]);

  useEffect(() => {
    if (speaking) return;
    const afterSpeech = speechFocus.current;
    speechFocus.current = null;
    if (open && (!afterSpeech || (afterSpeech.restore &&
      (document.activeElement === launcherRef.current || document.activeElement === document.body)))) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [open, speaking]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!drawerOpen || !transcript) return;
    const latestReply = transcript.querySelectorAll<HTMLElement>("[data-assistant-reply]");
    const reply = turns.at(-1)?.answer ? latestReply[latestReply.length - 1] : undefined;
    if (reply && reply.offsetHeight > transcript.clientHeight - 12) {
      const top = transcript.scrollTop + reply.getBoundingClientRect().top - transcript.getBoundingClientRect().top - 10;
      transcript.scrollTop = top;
    } else {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [drawerOpen, turns]);

  function interruptSpeech() {
    stopVoice();
    setOpen(true);
    setReadingClock({ startMs: performance.now(), offset: shownChars.current });
  }

  function ask(value: string) {
    const cleanQuestion = value.trim();
    if (!cleanQuestion || pending) return;

    stopVoice();
    shownChars.current = 0;
    setReadingClock(null);
    if (voiceActive.current) void audioContext.current?.resume().catch(() => {});
    setAnimatedTurn(turns.length);
    setQuestion("");
    inputRef.current?.focus({ preventScroll: true });
    try {
      const result = onAsk(cleanQuestion, {
        history: turns.slice(-6).flatMap(({ question, answer }) => answer ? [{ question, answer: answer.text.slice(0, 900) }] : []),
        previousSelection: [...turns].reverse().flatMap(({ answer }) => answer?.pointers ?? []).find(({ selection }) => selection)?.selection,
      });
      if (result instanceof Promise) {
        setTurns((history) => [...history, { question: cleanQuestion }]);
        const finish = (answer: PageAssistantAnswer) => {
          setTurns((history) => [...history.slice(0, -1), { question: cleanQuestion, answer }]);
          void speak(answer);
        };
        void result.then(finish, () => finish(unavailable));
      } else {
        setTurns((history) => [...history, { question: cleanQuestion, answer: result }]);
        void speak(result);
      }
    } catch {
      setTurns((history) => [...history, { question: cleanQuestion, answer: unavailable }]);
      void speak(unavailable);
    }
  }

  function minimize() {
    setOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      event.stopPropagation();
      minimize();
    }
  }

  return (
    <>
    {captionClock && <VoiceCaptions key={captionClock.startSeconds} clock={captionClock} visible={speaking} />}
    <div className={styles.assistant} data-side={side} data-open={drawerOpen} data-has-turns={turns.length > 0}>
      <section
        aria-labelledby={titleId}
        className={styles.drawer}
        inert={!drawerOpen}
        id={panelId}
        ref={drawerRef}
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <header className={styles.header}>
          <span className={styles.emblem}><MessageCircleQuestion size={18} aria-hidden="true" /></span>
          <h2 id={titleId}>Asistente de AETHER-SI</h2>
          {speechEnabled && <button type="button" role="switch" aria-checked={voiceOn} aria-label="Voz automática"
            className={styles.voiceSwitch} onClick={toggleVoice}
            title={voiceStatus || "Voz automática"}>
            <Volume2 size={14} aria-hidden="true" /> Voz <span aria-hidden="true" />
          </button>}
          {turns.length > 0 && <button
            type="button"
            className={styles.iconButton}
            aria-label="Limpiar conversación"
            title="Limpiar conversación"
            disabled={pending}
            onClick={() => {
              stopVoice();
              previousError.current = false;
              setAnimatedTurn(null);
              onClear?.();
              setTurns([]);
              setQuestion("");
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>}
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Minimizar conversación"
            title="Minimizar conversación"
            onClick={minimize}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.transcript} ref={transcriptRef} tabIndex={0} role="region" aria-label="Historial del asistente">
          {turns.length === 0 && <div className={styles.welcome}>
            <p>Pregunta sobre los experimentos o cómo usar la consola.</p>
            <div className={styles.examples}>
              {examples.map((example) => <button type="button" key={example} onClick={() => ask(example)}>
                <span>{example}</span><ArrowUpRight size={13} aria-hidden="true" />
              </button>)}
            </div>
          </div>}
          <div role="log" aria-label="Conversación" className={styles.turns}>
            {turns.map(({ question: asked, answer }, index) => <div className={styles.turn} key={index}>
              <p className={styles.question}><span className="sr-only">Tu pregunta: </span>{asked}</p>
              <div className={styles.answer}>
                <AssistantReply answer={answer} animate={animatedTurn === index} clock={readingClock}
                  onProgress={(reply, count) => {
                    shownChars.current = count;
                    onProgress?.(reply, count);
                  }}
                  onNavigate={(pointer) => {
                  minimize();
                  onNavigate(pointer);
                }} />
              </div>
            </div>)}
          </div>
        </div>

        <form className={styles.composer} onSubmit={handleSubmit}>
          <input
            aria-label="Pregunta al asistente"
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            autoComplete="off"
            maxLength={400}
            placeholder="Escribe una pregunta…"
          />
          <button type="submit" aria-label="Enviar pregunta" disabled={pending || !question.trim()}>
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </form>
      </section>

      <button
        type="button"
        className={styles.launcher}
        aria-controls={panelId}
        aria-expanded={drawerOpen}
        aria-label={speaking ? "Detener narración" : open ? "Minimizar asistente" : "Abrir asistente"}
        onClick={() => speaking ? interruptSpeech() : open ? minimize() : setOpen(true)}
        onKeyDown={(event) => { if (speaking && event.key === "Escape") interruptSpeech(); }}
        ref={launcherRef}
      >
        {speaking ? <VolumeX size={18} aria-hidden="true" /> : <MessageCircleQuestion size={19} aria-hidden="true" />}
        {speaking ? "Detener voz" : "Asistente"}
      </button>
      {speechEnabled && <span className="sr-only" role="status">{voiceStatus}</span>}
    </div>
    </>
  );
}
