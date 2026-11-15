"use client";
/**
 * Aceternity's TypewriterEffect, extended with:
 *  - `delay`      : wait before the first letter appears (seconds)
 *  - `stagger`    : seconds per letter
 *  - `onComplete` : fires once the last letter is typed (used to trigger screen 2)
 *  - `onLetter`   : fires as each letter appears (used for the typing sound)
 * Same `words` API as the original, so your existing usage still works.
 */
import { motion, stagger as staggerFn, useAnimate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export type TypewriterWord = { text: string; className?: string };

export function TypewriterEffect({
  words,
  className,
  cursorClassName,
  delay = 0,
  stagger = 0.1,
  onComplete,
  onLetter,
  font,
  fontTimeout = 1500,
}: {
  words: TypewriterWord[];
  className?: string;
  cursorClassName?: string;
  delay?: number;
  stagger?: number;
  onComplete?: () => void;
  onLetter?: (index: number) => void;
  /**
   * CSS font shorthand to wait for before typing (e.g. `700 1em Neoteric`), so the invisible
   * full-width copy is measured in the right font and nothing jumps. The wait counts towards
   * `delay`, so the timing stays the same.
   */
  font?: string;
  /** give up waiting for `font` after this many ms (the fallback font is used) */
  fontTimeout?: number;
}) {
  const wordsArray = words.map((w) => ({ ...w, text: w.text.split("") }));
  const fullText = words.map((w) => w.text).join(" ");
  const [scope, animate] = useAnimate();
  const isInView = useInView(scope);
  const done = useRef(onComplete);
  done.current = onComplete;
  const letter = useRef(onLetter);
  letter.current = onLetter;

  const mountedAt = useRef(performance.now());
  const [fontReady, setFontReady] = useState(!font || !("fonts" in document));
  useEffect(() => {
    if (fontReady || !font) return;
    let alive = true;
    const ready = () => alive && setFontReady(true);
    const t = setTimeout(ready, fontTimeout);
    document.fonts.load(font, fullText).then(ready, ready);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isInView || !fontReady) return;
    // time spent waiting for the font comes out of the start delay
    const start = Math.max(0, delay - (performance.now() - mountedAt.current) / 1000);
    const controls = animate(
      "span[data-char]",
      { display: "inline-block", opacity: 1, width: "fit-content" },
      { duration: 0.25, delay: staggerFn(stagger, { startDelay: start }), ease: "easeInOut" },
    );
    controls.then(() => done.current?.());
    const count = words.reduce((n, w) => n + w.text.length, 0);
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => letter.current?.(i), (start + i * stagger) * 1000),
    );
    return () => {
      controls.stop();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, fontReady]);

  return (
    // An invisible copy of the full title reserves the final width, and the typed
    // letters are laid over it left-aligned — so the line doesn't slide sideways
    // as it grows (the original re-centres on every letter).
    <div className={cn("relative inline-block whitespace-nowrap", className)}>
      <span aria-hidden className="invisible">
        {words.map((w) => w.text).join(" ")}
      </span>
      <motion.div ref={scope} className="absolute inset-0 text-left" aria-label={words.map((w) => w.text).join(" ")}>
        {wordsArray.map((word, i) => (
          <div key={`word-${i}`} className="inline-block">
            {word.text.map((char, j) => (
              <motion.span
                data-char
                initial={{}}
                key={`char-${j}`}
                className={cn("hidden opacity-0", word.className)}
              >
                {char}
              </motion.span>
            ))}
            {i < wordsArray.length - 1 && <>&nbsp;</>}
          </div>
        ))}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
          className={cn("inline-block rounded-sm align-middle", cursorClassName)}
        />
      </motion.div>
    </div>
  );
}
