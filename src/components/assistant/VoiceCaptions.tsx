import { useEffect, useMemo, useState } from "react";
import styles from "./EvidenceAssistant.module.css";

export interface SpeechClock {
  audio: AudioContext;
  startSeconds: number;
  playbackRate: number;
  duration: number;
  ends: number[];
  spokenText: string;
  spokenStarts: number[];
  spokenEnds: number[];
}

const sentences = new Intl.Segmenter("es", { granularity: "sentence" });
const maxCaptionLength = 94;

function captionPages(text: string) {
  const pages: { text: string; offset: number }[][] = [];
  for (const { segment, index } of sentences.segment(text)) {
    let line: { text: string; offset: number }[] = [];
    for (const word of segment.matchAll(/\S+/g)) {
      const part = { text: word[0], offset: index + word.index };
      if (line.length && part.offset + part.text.length - line[0].offset > maxCaptionLength) {
        pages.push(line);
        line = [];
      }
      line.push(part);
    }
    if (line.length) pages.push(line);
  }
  return pages;
}

export function VoiceCaptions({ clock, visible }: { clock: SpeechClock; visible: boolean }) {
  const pages = useMemo(() => captionPages(clock.spokenText), [clock.spokenText]);
  const [progress, setProgress] = useState({ page: 0, word: -1 });

  useEffect(() => {
    if (!visible || !pages.length) return;
    const { spokenText, spokenStarts, spokenEnds, duration } = clock;
    let frame = 0;
    let page = 0;
    let word = -1;
    function beginsAt(offset: number) {
      if (spokenStarts.length === spokenText.length) return spokenStarts[offset];
      return spokenEnds.length === spokenText.length ? (spokenEnds[offset - 1] ?? 0) : duration * offset / spokenText.length;
    }
    function tick() {
      const elapsed = (clock.audio.currentTime - clock.startSeconds) * clock.playbackRate;
      const priorPage = page;
      const priorWord = word;
      while (page + 1 < pages.length && elapsed >= beginsAt(pages[page + 1][0].offset)) {
        page += 1;
        word = -1;
      }
      while (pages[page][word + 1] && elapsed >= beginsAt(pages[page][word + 1].offset)) word += 1;
      if (page !== priorPage || word !== priorWord) setProgress({ page, word });
      if (elapsed < duration) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, pages, visible]);

  return <div className={styles.captionOverlay} data-visible={visible} aria-hidden="true">
    {pages[progress.page] && <p className={styles.caption} key={progress.page}>
      {pages[progress.page].map(({ text, offset }, index) => <span key={offset} data-spoken={index <= progress.word}>
        {index > 0 && " "}{text}
      </span>)}
    </p>}
  </div>;
}
