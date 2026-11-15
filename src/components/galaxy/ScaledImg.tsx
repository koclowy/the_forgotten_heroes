"use client";
/**
 * Resolution switching for the x1 / x2 / x3 image folders.
 *
 * Plain 1x/2x density switching isn't enough here: art is drawn at stage-relative sizes that
 * change a lot during zooms (a planet goes from ~11 % of the stage to 115 %). So:
 *  - x1 of everything is preloaded at startup (App.tsx).
 *  - Each image measures its rendered size × devicePixelRatio and compares it to x1's natural
 *    size. It picks the smallest variant that is sharp enough (x2 ≈ 2× x1, x3 ≈ 3× x1).
 *  - It only ever upgrades (no flicker), loads the bigger file in the background and swaps the
 *    src only once that file is downloaded and decoded (no flash, no blank frame).
 *  - prewarmScaled() loads, in idle time, the variant that zooming things (planets, equipment
 *    frames, Nova, background) will need at their LARGEST size in config.ts, so the swap
 *    has usually happened before the zoom even starts.
 */
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { SCALES, SCALE_FACTOR, baseOf, imageDims, loadImage, loadedImages, type Scale, type Scaled } from "../../content/assets";
export type { Scale, Scaled };
import type { Content } from "../../content/load";
import { EQUIPMENT_ART_SCALE_ZOOMED, FOCUS_FRAME, SCIENTIST, SURFACE_EXIT_LAYOUT, SURFACE_LAYOUT } from "./config";

/** how the image fills its box: by width, by height, or like object-fit cover / contain */
export type Fit = "width" | "height" | "cover" | "contain";

const SHARP_ENOUGH = 1.1; // allow ~10 % upscaling before asking for the next size

/** x1 pixel size of a set (derived from whichever file was loaded first). */
function x1Size(v: Scaled | undefined) {
  if (!v) return null;
  for (const s of SCALES) {
    const u = v[s];
    const d = u && imageDims.get(u);
    if (d) return { w: d.w / SCALE_FACTOR[s], h: d.h / SCALE_FACTOR[s] };
  }
  return null;
}

/** Needed size (device px) of a w×h CSS-px box → which scale is sharp enough. */
export function levelFor(v: Scaled | undefined, boxW: number, boxH: number, fit: Fit, extra = 1): Scale {
  const s = x1Size(v);
  if (!s || !s.w || !s.h) return "x1";
  const dpr = (window.devicePixelRatio || 1) * extra;
  const rw = boxW / s.w;
  const rh = boxH / s.h;
  const r = (fit === "width" ? rw : fit === "height" ? rh : fit === "cover" ? Math.max(rw, rh) : Math.min(rw, rh)) * dpr;
  return r <= SHARP_ENOUGH ? "x1" : r <= 2 * SHARP_ENOUGH ? "x2" : "x3";
}

/** The file to use for a wanted level: the smallest available ≥ level, else the biggest there is. */
function targetUrl(v: Scaled, level: Scale) {
  const i = SCALES.indexOf(level);
  for (const s of SCALES.slice(i)) if (v[s]) return v[s]!;
  for (const s of [...SCALES].reverse()) if (v[s]) return v[s]!;
  return undefined;
}

const maxScale = (a: Scale, b: Scale) => (SCALES.indexOf(a) >= SCALES.indexOf(b) ? a : b);

/**
 * Measures `ref` and returns the scale it needs. Never goes down.
 * `extra` = an additional zoom on top of the layout size (e.g. the backdrop's depth scale).
 */
export function useScaleLevel(
  ref: React.RefObject<HTMLElement | null>,
  v: Scaled | undefined,
  fit: Fit,
  extra = 1,
  enabled = true,
): Scale {
  const [level, setLevel] = useState<Scale>("x1");
  const vRef = useRef(v);
  vRef.current = v;
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !vRef.current) return;
    const l = levelFor(vRef.current, el.offsetWidth, el.offsetHeight, fit, extra);
    setLevel((cur) => maxScale(cur, l));
  }, [ref, fit, extra]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, measure, ref]);

  // x1 size may only be known once it has loaded
  useEffect(() => {
    if (!enabled || !v || x1Size(v)) return;
    const b = baseOf(v);
    if (b) loadImage(b).then(measure);
  }, [enabled, v, measure]);

  return level;
}

/**
 * The URL to show for `v` at `level`: the wanted file once it's loaded, until then the best
 * file that IS loaded (so the visible image never goes blank or gets worse).
 */
export function useScaledUrl(v: Scaled | undefined, level: Scale): string | undefined {
  const [, tick] = useState(0);
  const want = v ? targetUrl(v, level) : undefined;
  useEffect(() => {
    if (!want || loadedImages.has(want)) return;
    let alive = true;
    loadImage(want).then(() => alive && tick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [want]);
  if (!v) return undefined;
  if (want && loadedImages.has(want)) return want;
  // until then: the sharpest file that is already loaded (never a blank frame)
  for (const s of [...SCALES].reverse()) if (v[s] && loadedImages.has(v[s]!)) return v[s];
  return baseOf(v);
}

/** Measure + pick in one go, for a single element. */
export function useScaledSrc<T extends HTMLElement = HTMLImageElement>(v: Scaled | undefined, fit: Fit = "width", extra = 1) {
  const ref = useRef<T>(null);
  const level = useScaleLevel(ref, v, fit, extra);
  return { ref, src: useScaledUrl(v, level) };
}

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: Scaled | undefined;
  fit?: Fit;
  /** use a level measured elsewhere (e.g. all of Nova's layers follow her body) */
  level?: Scale;
  /** a CSS scale applied around the image (layout size doesn't include it) */
  extra?: number;
};

/** <img> that picks x1 / x2 / x3 by its rendered size. Renders nothing without a source. */
export const ScaledImg = forwardRef<HTMLImageElement, ImgProps>(function ScaledImg({ src, fit = "width", level, extra = 1, ...rest }, fwd) {
  const own = useRef<HTMLImageElement>(null);
  const measured = useScaleLevel(own, src, fit, extra, level === undefined);
  const url = useScaledUrl(src, level ?? measured);
  const setRef = (el: HTMLImageElement | null) => {
    own.current = el;
    if (typeof fwd === "function") fwd(el);
    else if (fwd) fwd.current = el;
  };
  if (!url) return null;
  return <img ref={setRef} src={url} {...rest} />;
});

/* ------------------------------------------------------------------ */
/* Pre-warming                                                         */
/* ------------------------------------------------------------------ */

const idle = (fn: () => void) =>
  "requestIdleCallback" in window
    ? (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback(fn, { timeout: 4000 })
    : setTimeout(fn, 200);

/**
 * After startup, load (in idle time, one file at a time) the variant each zooming image will
 * need at its largest size from config.ts, at the current stage size + devicePixelRatio.
 * Re-run on resize; already-loaded files are skipped.
 */
export function prewarmScaled(c: Content) {
  const stageW = Math.min(window.innerWidth, (window.innerHeight * 16) / 9);
  const stageH = (stageW * 9) / 16;
  const jobs: string[] = [];
  const want = (v: Scaled | undefined, w: number, h: number, fit: Fit, extra = 1) => {
    if (!v) return;
    const u = targetUrl(v, levelFor(v, w, h, fit, extra));
    if (u && u !== baseOf(v) && !loadedImages.has(u)) jobs.push(u);
  };

  // planets: biggest is the horizon / sinking-out layout
  const planetW = (Math.max(SURFACE_LAYOUT.w, SURFACE_EXIT_LAYOUT.w) / 100) * stageW;
  for (const p of Object.values(c.planets)) want(p.image, planetW, planetW, "cover");
  // equipment: the big focus frame (the info modal image is smaller)
  const fw = (FOCUS_FRAME.w / 100) * stageW;
  const fh = (FOCUS_FRAME.h / 100) * stageH;
  for (const e of Object.values(c.equipment)) want(e.image, fw, fh, "contain", EQUIPMENT_ART_SCALE_ZOOMED * e.imageScale);
  // (the "i" card photos and the starfield load only when shown)
  // Nova: biggest is the intro / ending "stage" layout; all layers share the body's canvas
  const novaH = (Math.max(SCIENTIST.stage.h, SCIENTIST.corner.h, SCIENTIST.chat.h) / 100) * stageH;
  for (const group of Object.values(c.art.nova.layers)) for (const v of Object.values(group)) want(v, 0, novaH, "height");
  // background: viewport + 10 % bleed each side, times the deepest backdrop zoom (1.16)
  want(c.art.background, window.innerWidth * 1.2, window.innerHeight * 1.2, "cover", 1.16);

  const unique = [...new Set(jobs)];
  const next = () => {
    const u = unique.shift();
    if (!u) return;
    idle(() => loadImage(u).then(next));
  };
  next();
}
