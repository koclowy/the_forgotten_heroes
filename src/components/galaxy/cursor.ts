/**
 * Custom cursor: native CSS cursors (no JS-drawn cursor, so zero lag).
 * Sets --cursor-idle / --cursor-tap on <html> from assets.json → images.cursor;
 * the rules that use them live in galaxy.css. The system cursor is always the last fallback.
 */
import { useEffect } from "react";
import { SCALES, SCALE_FACTOR, type Scaled } from "../../content/assets";
import type { Content } from "../../content/load";

type Cursor = { image: Scaled; hotspot: [number, number] };

/** url(x1) X Y, then image-set(x1 1x, x2 2x, x3 3x) X Y. Hotspot is in x1 pixels. */
// x1 is exported at the on-screen size (npm run cursors), and image-set's 1x / 2x / 3x tell the
// browser each file's density, so the cursor stays the same CSS size on 1×, 2× and 3× screens.
function cursorValues(c: Cursor | undefined, fallback: string) {
  if (!c) return { plain: fallback, set: fallback };
  const [x, y] = c.hotspot.map((n) => Math.round(n));
  const base = c.image.x1 ?? c.image.x2 ?? c.image.x3!;
  const list = SCALES.filter((s) => c.image[s]).map((s) => `url("${c.image[s]}") ${SCALE_FACTOR[s]}x`);
  return {
    plain: `url("${base}") ${x} ${y}, ${fallback}`,
    set: `image-set(${list.join(", ")}) ${x} ${y}, ${fallback}`,
    webkit: `-webkit-image-set(${list.join(", ")}) ${x} ${y}, ${fallback}`,
  };
}

export function useCursor(cursor: Content["art"]["cursor"]) {
  const { idle: ci, tap: ct } = cursor;
  useEffect(() => {
    const root = document.documentElement.style;
    const cursor = { idle: ci, tap: ct };
    const idle = cursorValues(cursor.idle, "auto");
    const tap = cursorValues(cursor.tap, "pointer");
    // pick the best form this browser understands (CSS.supports checks the whole value)
    const best = (v: ReturnType<typeof cursorValues>) =>
      CSS.supports("cursor", v.set) ? v.set : v.webkit && CSS.supports("cursor", v.webkit) ? v.webkit : v.plain;
    root.setProperty("--cursor-idle", best(idle));
    root.setProperty("--cursor-tap", best(tap));
    return () => {
      root.removeProperty("--cursor-idle");
      root.removeProperty("--cursor-tap");
    };
  }, [ci, ct]);
}
