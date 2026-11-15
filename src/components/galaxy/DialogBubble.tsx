"use client";
/**
 * A dialog box that types its text out and GROWS to fit it as it types.
 * - Click anywhere (or Enter / Space / →) while typing → finish the line instantly.
 * - Click when finished → `onAdvance` (next line). Only the `active` box responds.
 * Used for the scientist, the equipment's speech bubble and the description panel.
 */
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { sound } from "../../audio/sound";
import { parseRich, type RichNode } from "../../content/richText";
import { useAdvanceSlot } from "./advance";
import { COLORS, TIMING } from "./config";

/** <chorus> lines: the equipment's voice, quieter and a little lower (another, more distant speaker). */
const CHORUS_VOICE = { gain: 0.7, pitch: 0.88 };

/**
 * Render the first `budget` visible characters of a parsed text as React elements (never HTML).
 * Elements whose text hasn't started typing yet aren't rendered, so a <chorus> line break only
 * appears with its first letter.
 */
function renderRich(nodes: RichNode[], budget: number): ReactNode[] {
  const out: ReactNode[] = [];
  let left = budget;
  const walk = (list: RichNode[], into: ReactNode[]) => {
    for (const n of list) {
      if (left <= 0) return;
      if (typeof n === "string") {
        into.push(n.length <= left ? n : n.slice(0, left));
        left -= n.length;
        continue;
      }
      const kids: ReactNode[] = [];
      walk(n.children, kids);
      const key = into.length;
      if (!kids.length) continue;
      if (n.tag === "i") into.push(<i key={key} className="dialog-i">{kids}</i>);
      else if (n.tag === "b") into.push(<b key={key} className="dialog-b">{kids}</b>);
      else if (n.tag === "small") into.push(<small key={key} className="dialog-small">{kids}</small>);
      else into.push(<span key={key} className="dialog-chorus">{kids}</span>);
    }
  };
  walk(nodes, out);
  return out;
}

export function useTypewriter(text: string, resetKey: unknown, delay = 0, onChar?: (c: string, i: number) => void) {
  const [n, setN] = useState(0);
  const iRef = useRef(0);
  const charRef = useRef(onChar);
  charRef.current = onChar;
  useEffect(() => {
    iRef.current = 0;
    setN(0);
    let iv: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      iv = setInterval(() => {
        if (iRef.current >= text.length) return clearInterval(iv);
        charRef.current?.(text[iRef.current], iRef.current);
        iRef.current += 1;
        setN(iRef.current);
      }, 1000 / TIMING.dialogCharsPerSecond);
    }, delay * 1000);
    return () => {
      clearTimeout(start);
      clearInterval(iv);
    };
  }, [text, resetKey, delay]);
  const finish = () => {
    iRef.current = text.length;
    setN(text.length);
  };
  return { shown: text.slice(0, n), done: n >= text.length, finish };
}

type Tail = "left" | "bottom-left" | "none";

export function DialogBubble({
  text,
  resetKey,
  name,
  active = true,
  onAdvance,
  button,
  onButton,
  footer,
  maxWidth = "30cqw",
  width,
  tail = "left",
  variant = "bubble",
  delay = 0,
  voice,
  chorusVoice,
  onTyping,
  className,
  style,
}: {
  text: string;
  /** change this to restart typing even if the text is identical */
  resetKey?: unknown;
  name?: string;
  active?: boolean;
  onAdvance?: () => void;
  /** optional action button shown once the text is fully typed */
  button?: string;
  onButton?: () => void;
  /** extra row under the text (pager etc.) */
  footer?: (done: boolean) => ReactNode;
  maxWidth?: string;
  /** fixed width (only the height animates) */
  width?: string;
  tail?: Tail;
  variant?: "bubble" | "panel";
  delay?: number;
  /** voice blip sounds played while typing */
  voice?: string[];
  /** voice for <chorus> parts (default: `voice`), always played quieter + lower */
  chorusVoice?: string[];
  /** true while letters are still appearing (drives the scientist's mouth) */
  onTyping?: (typing: boolean) => void;
  className?: string;
  style?: CSSProperties;
}) {
  // <i> <b> <small> <chorus>: only the visible characters are typed, counted and voiced
  const rich = useMemo(() => parseRich(text), [text]);
  const { shown, done, finish } = useTypewriter(rich.visible, resetKey, delay, (c, i) => {
    const inChorus = rich.chorus[i];
    const newWord = inChorus !== (rich.chorus[i - 1] ?? false); // a voice change starts a new word
    if (inChorus) sound.voice(chorusVoice?.length ? chorusVoice : voice, c, i, rich.visible, { ...CHORUS_VOICE, newWord });
    else sound.voice(voice, c, i, rich.visible, { newWord });
  });
  // line finished (typed out or skipped) / box gone → this speaker's babble stops with it
  const voiceRef = useRef([voice, chorusVoice]);
  voiceRef.current = [voice, chorusVoice];
  useEffect(() => {
    if (done) voiceRef.current.forEach((v) => sound.stopVoice(v));
  }, [done]);
  useEffect(() => () => voiceRef.current.forEach((v) => sound.stopVoice(v)), []);
  const typingRef = useRef(onTyping);
  typingRef.current = onTyping;
  const started = shown.length > 0;
  useEffect(() => typingRef.current?.(started && !done), [started, done]);
  useEffect(() => () => typingRef.current?.(false), []);
  const measure = useRef<HTMLDivElement>(null);
  const self = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    setSize({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // a click anywhere on the stage (or Enter / Space / →) drives the ACTIVE box — see advance.tsx
  const advance = () => {
    if (!done) {
      finish();
      return true;
    }
    if (button) return false; // lines with a button wait for the button
    onAdvance?.();
    return true;
  };
  useAdvanceSlot(active && !!onAdvance, advance, done && !button);

  const isPanel = variant === "panel";
  const border = isPanel ? "none" : `max(2px,0.3cqw) solid ${COLORS.bubbleBorder}`;
  const bg = isPanel ? "#D9D9D9" : "#FFFBF2";

  return (
    <div ref={self} className={className} style={{ ...style }}>
      {/* outer box follows the measured text size with a CSS transition → it "grows" as text types */}
      <div
        aria-live="polite"
        className="relative overflow-hidden"
        style={{
          boxSizing: "content-box",
          background: bg,
          border,
          borderRadius: isPanel ? "0.3cqw" : "0.9cqw",
          color: isPanel ? "#1a1d33" : "#111",
          width: width ?? size.w,
          height: size.h,
          opacity: active ? 1 : 0.62,
          boxShadow: active ? "0 0.4cqw 1.6cqw rgba(0,0,0,.25)" : "none",
          transition: "width .22s cubic-bezier(.2,.8,.3,1), height .22s cubic-bezier(.2,.8,.3,1), opacity .3s, box-shadow .3s",
        }}
      >
        <div
          ref={measure}
          className="absolute left-0 top-0"
          style={{
            width: width ? "100%" : "max-content",
            maxWidth: width ? undefined : maxWidth,
            padding: isPanel ? "1.1cqw 2cqw" : "0.9cqw 1.3cqw",
            fontSize: isPanel ? "1.25cqw" : "1.2cqw",
            lineHeight: 1.42,
          }}
        >
          {name && (
            <div
              className="uppercase"
              style={{ fontSize: "0.9cqw", letterSpacing: "0.12em", color: COLORS.bubbleBorder, marginBottom: "0.2cqw" }}
            >
              {name}
            </div>
          )}
          <span>{shown ? renderRich(rich.nodes, shown.length) : " "}</span>
          {button && done && (
            <div style={{ marginTop: "0.8cqw" }}>
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onButton?.();
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full text-white"
                style={{ background: COLORS.bubbleBorder, padding: "0.5cqw 1.6cqw", fontSize: "1.1cqw", letterSpacing: "0.04em" }}
              >
                {button}
              </motion.button>
            </div>
          )}
          {footer?.(done)}
        </div>
      </div>
      {tail !== "none" && !isPanel && <BubbleTail tail={tail} active={active} />}
    </div>
  );
}

function BubbleTail({ tail, active }: { tail: Tail; active: boolean }) {
  const pos: CSSProperties =
    tail === "left"
      ? { left: "-1.15cqw", top: "1.6cqw", width: "1.4cqw", transform: "rotate(90deg)" }
      : { left: "2.2cqw", bottom: "-1.2cqw", width: "1.6cqw" };
  return (
    <svg className="absolute" style={{ ...pos, opacity: active ? 1 : 0.62 }} viewBox="0 0 16 14">
      <path d="M2 0 L4 13 L14 0" fill="#FFFBF2" stroke={COLORS.bubbleBorder} strokeWidth="2.6" strokeLinejoin="round" />
      <rect x="0" y="-2" width="16" height="3.6" fill="#FFFBF2" />
    </svg>
  );
}
