"use client";

import { ArrowUp, ArrowUpRight, MessageCircleQuestion, Minus, MousePointer2, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AssistantPointer, PageAssistantAnswer } from "../../core/si-engine/page-assistant";
import styles from "./EvidenceAssistant.module.css";

export interface AssistantConversationContext {
  previousQuestion?: string;
  previousSelection?: AssistantPointer["selection"];
}

interface EvidenceAssistantProps {
  onAsk: (question: string, context: AssistantConversationContext) => PageAssistantAnswer | Promise<PageAssistantAnswer>;
  onNavigate: (pointer: AssistantPointer) => void;
  side?: "left" | "right";
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

function AssistantReply({ answer, onNavigate }: {
  answer: PageAssistantAnswer | undefined;
  onNavigate: (pointer: AssistantPointer) => void;
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
      <p><span className="sr-only">Respuesta: </span>{answer.text}</p>
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

export function EvidenceAssistant({ onAsk, onNavigate, side = "right" }: EvidenceAssistantProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();
  const previousTurn = turns.at(-1);
  const pending = previousTurn !== undefined && previousTurn.answer === undefined;

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

    setQuestion("");
    inputRef.current?.focus({ preventScroll: true });
    try {
      const result = onAsk(cleanQuestion, {
        previousQuestion: previousTurn?.question,
        previousSelection: previousTurn?.answer?.pointers.find(({ selection }) => selection)?.selection,
      });
      if (result instanceof Promise) {
        setTurns((history) => [...history, { question: cleanQuestion }]);
        const finish = (answer: PageAssistantAnswer) => {
          setTurns((history) => [...history.slice(0, -1), { question: cleanQuestion, answer }]);
        };
        void result.then(finish, () => finish(unavailable));
      } else {
        setTurns((history) => [...history, { question: cleanQuestion, answer: result }]);
      }
    } catch {
      setTurns((history) => [...history, { question: cleanQuestion, answer: unavailable }]);
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
          {turns.length > 0 && <button
            type="button"
            className={styles.iconButton}
            aria-label="Limpiar conversación"
            title="Limpiar conversación"
            disabled={pending}
            onClick={() => {
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
                <AssistantReply answer={answer} onNavigate={(pointer) => {
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
