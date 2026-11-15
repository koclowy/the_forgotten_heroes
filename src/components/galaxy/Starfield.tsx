"use client";
/**
 * One big star layer (assets/image/stars/{x}/…) drifting slowly and endlessly, so it feels
 * like travelling through space. It sits inside the backdrop, so it also gets the depth push-in.
 *
 * The image doesn't have to tile: it's laid out as  original | mirrored | original | mirrored …
 * Mirrored edges always match, so shifting the strip by two tiles is a seamless loop.
 * The strip is moved with a single translate3d animation (GPU only, no repaints), and the whole
 * layer is tilted by STARFIELD.tiltDeg, which turns the right → left drift into a slight diagonal.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SCALES, type Scaled } from "../../content/assets";
import { STARFIELD } from "./config";
import { useScaleLevel, useScaledUrl } from "./ScaledImg";

export function Starfield({ src, depth }: { src?: Scaled; depth: number }) {
  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLImageElement>(null);
  const [tiles, setTiles] = useState(4);

  // pick x1 / x2 by the tile's size (incl. the depth push-in), never above STARFIELD.maxScale
  const want = useScaleLevel(tile, src, "height", depth);
  const cap = SCALES.indexOf(STARFIELD.maxScale);
  const url = useScaledUrl(src, SCALES[Math.min(SCALES.indexOf(want), cap)]);
  const hasUrl = !!url;

  // enough tiles to cover the layer plus the two-tile loop (always an even number)
  useLayoutEffect(() => {
    const b = box.current;
    const t = tile.current;
    if (!b || !t) return;
    const fit = () => {
      if (!t.offsetWidth) return;
      const n = Math.ceil(b.offsetWidth / t.offsetWidth) + 2;
      setTiles(n + (n % 2));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    ro.observe(t);
    fit();
    return () => ro.disconnect();
  }, [hasUrl]);

  // the drift: one linear translate3d loop over two tile widths. It keeps running when the file is
  // swapped for a sharper one (same size on screen), and resumes at the same progress on resize.
  useEffect(() => {
    const s = strip.current;
    const t = tile.current;
    if (!s || !t || !hasUrl) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let anim: Animation | undefined;
    const start = () => {
      const progress = anim ? Number(anim.currentTime ?? 0) / Number(anim.effect?.getTiming().duration ?? 1) : 0;
      anim?.cancel();
      anim = undefined;
      if (reduce.matches && STARFIELD.stopForReducedMotion) return;
      const loop = 2 * t.offsetWidth;
      const screen = window.innerWidth || 1;
      if (!loop) return;
      const duration = STARFIELD.secondsPerScreen * 1000 * (loop / screen);
      anim = s.animate([{ transform: "translate3d(0,0,0)" }, { transform: `translate3d(${-loop}px,0,0)` }], {
        duration,
        iterations: Infinity,
        easing: "linear",
      });
      anim.currentTime = (progress % 1) * duration;
    };
    const ro = new ResizeObserver(start);
    ro.observe(t);
    reduce.addEventListener("change", start);
    start();
    return () => {
      ro.disconnect();
      reduce.removeEventListener("change", start);
      anim?.cancel();
    };
  }, [hasUrl]);

  if (!src) return null;
  return (
    // 130 % of the backdrop, centred: covers the corners after the tilt
    <div
      ref={box}
      className="pointer-events-none absolute"
      style={{ inset: "-15%", transform: `rotate(${STARFIELD.tiltDeg}deg)`, opacity: STARFIELD.opacity }}
    >
      <div ref={strip} className="absolute left-0 top-0 flex h-full" style={{ willChange: "transform" }}>
        {Array.from({ length: tiles }, (_, i) => (
          <img
            key={i}
            ref={i === 0 ? tile : undefined}
            src={url}
            alt=""
            draggable={false}
            className="block h-full w-auto max-w-none"
            style={i % 2 ? { transform: "scaleX(-1)" } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
