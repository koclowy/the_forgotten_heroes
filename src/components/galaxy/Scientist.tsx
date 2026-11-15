"use client";
/**
 * Nova, drawn as layers (all full-size transparent PNGs on the SAME canvas as the bodies):
 *   body  →  mouth  →  eyes  →  brows        (bottom → top)
 * Which file each layer uses comes from the line's expression in content/nova.json.
 * She blinks on her own (blink.eyes) and her mouth flips between the expression's mouth and
 * its talk mouths while her text types.
 *
 * Files: assets/image/nova/{x}/body | eyes | brows | mouth / <name>.png  (see assets.json → images.nova)
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { novaLook, type NovaArt, type NovaLook } from "../../content/load";
import { QUICK, type SciPose } from "./config";
import { ScaledImg, useScaleLevel } from "./ScaledImg";

const toStyle = (p: SciPose) => ({ left: `${p.left}%`, top: `${p.bottom}%`, height: `${p.h}%` });

export type ScientistArt = NovaArt;

export function Scientist({
  art,
  look,
  at,
  from,
  talking,
}: {
  art: ScientistArt;
  /** expression + body (or an old pose name) of the current line */
  look?: NovaLook;
  at: SciPose;
  /** where she enters from / leaves to */
  from: SciPose;
  /** true while her dialog is typing → mouth moves */
  talking?: boolean;
}) {
  const { body, expression } = novaLook(art, look);
  const eyes = useBlink(!!art.blink && expression.blink);
  const mouth = useMouth(!!talking, expression.talkMouths.length);

  const L = art.layers;
  const eyeName =
    eyes === "open" || !art.blink
      ? expression.eyes
      : eyes === "half"
        ? (art.blink.half[expression.eyes ?? ""] ?? art.blink.closed)
        : art.blink.closed;
  const mouthName = mouth < 0 ? expression.mouth : (expression.talkMouths[mouth] ?? expression.mouth);

  // every layer shares the body's canvas, so they all use the body's resolution level
  const bodyRef = useRef<HTMLImageElement>(null);
  const level = useScaleLevel(bodyRef, L.body[body], "height");
  const layer = (v: (typeof L.body)[string] | undefined) =>
    v && <ScaledImg src={v} level={level} alt="" draggable={false} className="absolute inset-0 h-full w-full" />;

  return (
    <motion.div
      className="pointer-events-none absolute z-[10]"
      style={{ x: "-50%", y: "-100%" }}
      initial={toStyle(from)}
      animate={toStyle(at)}
      exit={{ ...toStyle(from), transition: { ...QUICK, duration: 0.8 } }}
      transition={QUICK}
    >
      <motion.div
        className="relative h-full"
        animate={talking ? { y: [0, -4, 0] } : { y: [0, -2, 0] }}
        transition={{ duration: talking ? 0.5 : 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={body}
            className="relative h-full"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ScaledImg ref={bodyRef} src={L.body[body]} level={level} alt="" draggable={false} className="block h-full w-auto max-w-none" />
            {layer(mouthName ? L.mouth[mouthName] : undefined)}
            {layer(eyeName ? L.eyes[eyeName] : undefined)}
            {layer(expression.brows ? L.brows[expression.brows] : undefined)}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/** open → half → closed → half → open every few seconds (sometimes a double blink). */
function useBlink(enabled: boolean) {
  const [state, setState] = useState<"open" | "half" | "closed">("open");
  useEffect(() => {
    if (!enabled) return setState("open");
    let t: ReturnType<typeof setTimeout>;
    let alive = true;
    const seq = (steps: [typeof state, number][], then: () => void) => {
      const [s, ms] = steps[0];
      setState(s);
      t = setTimeout(() => (steps.length > 1 ? seq(steps.slice(1), then) : then()), ms);
    };
    const blink = () => {
      if (!alive) return;
      const once: [typeof state, number][] = [["half", 45], ["closed", 90], ["half", 45], ["open", 0]];
      const steps = Math.random() < 0.2 ? [...once.slice(0, 3), ["open", 120] as [typeof state, number], ...once] : once;
      seq(steps, () => (t = setTimeout(blink, 2200 + Math.random() * 3200)));
    };
    t = setTimeout(blink, 1500 + Math.random() * 2000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [enabled]);
  return state;
}

/** -1 = the expression's own mouth. While talking, flips between talk frames and it at a speech-like rhythm. */
function useMouth(talking: boolean, frames: number) {
  const [i, setI] = useState(-1);
  useEffect(() => {
    if (!talking || !frames) return setI(-1);
    let last = -1;
    const iv = setInterval(() => {
      // mostly open frames, sometimes closed, never the same frame twice
      let next = Math.random() < 0.28 ? -1 : Math.floor(Math.random() * frames);
      if (next === last) next = next === -1 ? 0 : -1;
      last = next;
      setI(next);
    }, 95);
    return () => clearInterval(iv);
  }, [talking, frames]);
  return i;
}
