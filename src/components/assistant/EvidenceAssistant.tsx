"use client";

import { ArrowUp, ArrowUpRight, MessageCircleQuestion, Minus, MousePointer2, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AssistantPointer, PageAssistantAnswer } from "../../core/si-engine/page-assistant";
import styles from "./EvidenceAssistant.module.css";

export interface AssistantConversationContext {
  history: { question: string; answer: string }[];
  previousSelection?: AssistantPointer["selection"];
}

interface EvidenceAssistantProps {
  onAsk: (question: string, context: AssistantConversationContext) => PageAssistantAnswer | Promise<PageAssistantAnswer>;
  onNavigate: (pointer: AssistantPointer) => void;
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

function WrittenReply({ text, animate }: { text: string; animate: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }
    const start = performance.now();
    const duration = Math.min(8600, Math.max(550, text.length * 12));
    let frame = 0;
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - start) / duration);
      setCount(Math.floor(text.length * fraction));
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, animate]);

  const visible = animate ? count : text.length;
  return <p>
    <span className="sr-only">Respuesta: {text}</span>
    <span aria-hidden="true">{text.slice(0, visible)}{visible < text.length && <span className={styles.caret} />}</span>
  </p>;
}

function AssistantReply({ answer, onNavigate, animate }: {
  answer: PageAssistantAnswer | undefined;
  onNavigate: (pointer: AssistantPointer) => void;
  animate: boolean;
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
      <WrittenReply text={answer.text} animate={animate} />
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

export function EvidenceAssistant({ onAsk, onNavigate, side = "right", speechEnabled }: EvidenceAssistantProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [restored, setRestored] = useState(false);
  const [animatedTurn, setAnimatedTurn] = useState<number | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceActive = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const speechSource = useRef<AudioBufferSourceNode | null>(null);
  const previousError = useRef(false);
  const speechRequest = useRef<AbortController | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();
  const previousTurn = turns.at(-1);
  const pending = previousTurn !== undefined && previousTurn.answer === undefined;

  useEffect(() => () => {
    speechRequest.current?.abort();
    if (audioContext.current) void audioContext.current.close().catch(() => {});
  }, []);

  function stopVoice() {
    speechRequest.current?.abort();
    const source = speechSource.current;
    speechSource.current = null;
    source?.stop();
  }

  async function speak(answer: PageAssistantAnswer) {
    const repeatedError = answer === unavailable && previousError.current;
    previousError.current = answer === unavailable;
    const context = audioContext.current;
    if (!voiceActive.current || !context || repeatedError) return;
    stopVoice();
    const controller = new AbortController();
    speechRequest.current = controller;
    try {
      const response = await fetch("/api/assistant/speech", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer.text }), signal: controller.signal,
      });
      if (!response.ok) throw new Error("Audio no disponible");
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (controller.signal.aborted) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (speechSource.current === source) speechSource.current = null;
      };
      source.start();
      speechSource.current = source;
    } catch {
      // La lectura es opcional y la respuesta escrita ya está disponible.
    }
  }

  function toggleVoice() {
    const enabled = !voiceActive.current;
    voiceActive.current = enabled;
    setVoiceOn(enabled);
    if (enabled) {
      audioContext.current ??= new AudioContext();
      void audioContext.current.resume().catch(() => {});
    } else stopVoice();
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
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!open || !transcript) return;
    const latestReply = transcript.querySelectorAll<HTMLElement>("[data-assistant-reply]");
    const reply = turns.at(-1)?.answer ? latestReply[latestReply.length - 1] : undefined;
    if (reply && reply.offsetHeight > transcript.clientHeight - 12) {
      const top = transcript.scrollTop + reply.getBoundingClientRect().top - transcript.getBoundingClientRect().top - 10;
      transcript.scrollTop = top;
    } else {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [open, turns]);

  function ask(value: string) {
    const cleanQuestion = value.trim();
    if (!cleanQuestion || pending) return;

    stopVoice();
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
    <div className={styles.assistant} data-side={side} data-open={open} data-has-turns={turns.length > 0}>
      <section
        aria-labelledby={titleId}
        className={styles.drawer}
        inert={!open}
        id={panelId}
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <header className={styles.header}>
          <span className={styles.emblem}><MessageCircleQuestion size={18} aria-hidden="true" /></span>
          <h2 id={titleId}>Asistente de AETHER-SI</h2>
          {speechEnabled && <button type="button" role="switch" aria-checked={voiceOn} aria-label="Voz automática"
            className={styles.voiceSwitch} onClick={toggleVoice}>
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
                <AssistantReply answer={answer} animate={animatedTurn === index}
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
        aria-expanded={open}
        aria-label={open ? "Minimizar asistente" : "Abrir asistente"}
        onClick={() => open ? minimize() : setOpen(true)}
        ref={launcherRef}
      >
        <MessageCircleQuestion size={19} aria-hidden="true" /> Asistente
      </button>
    </div>
  );
}
