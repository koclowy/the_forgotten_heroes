/**
 * npm run cursors
 *
 * Builds the mouse cursors from the large originals:
 *   public/assets/image/cursor/originals/idle.png, tap.png      (export these big, e.g. 384 px)
 * →  public/assets/image/cursor/x1|x2|x3/idle.png, tap.png      (size, 2× size, 3× size)
 * and writes the matching click points ("hotspot", in x1 px) into public/content/assets.json.
 *
 * The on-screen size comes from assets.json → images.cursor.size (CSS px, default 42).
 * Browsers ignore cursor images over 128 px, so a scale that would be bigger is skipped
 * (the browser then uses the next smaller one). 42 is the largest size where x3 (126 px) fits.
 *
 * Hotspots are measured on the original: idle = the pointer tip (the opaque pixel nearest the
 * top-left corner), tap = the finger tip (the middle of the topmost opaque row).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DIR = join(ROOT, "public/assets/image/cursor");
const ASSETS = join(ROOT, "public/content/assets.json");
const MAX = 128; // browser limit for cursor images
const ALPHA = 128; // a pixel counts as "solid" above this alpha

const json = readFileSync(ASSETS, "utf8");
const size = Number(JSON.parse(json).images?.cursor?.size ?? 42);
if (!(size > 0)) throw new Error(`assets.json → images.cursor.size must be a number of px (got ${size}).`);

/** Measure the click point on the original, in original pixels. */
async function tip(file, kind) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = (x, y) => data[(y * info.width + x) * info.channels + 3];
  if (kind === "idle") {
    let best = null;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (a(x, y) > ALPHA && (!best || x + y < best[0] + best[1])) best = [x, y];
    return { at: best, w: info.width, h: info.height };
  }
  for (let y = 0; y < info.height; y++) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < info.width; x++)
      if (a(x, y) > ALPHA) {
        if (x0 < 0) x0 = x;
        x1 = x;
      } else if (x0 >= 0) break; // first solid run only
    if (x0 >= 0) return { at: [(x0 + x1) / 2, y], w: info.width, h: info.height };
  }
  return { at: null, w: info.width, h: info.height };
}

let out = json;
for (const name of ["idle", "tap"]) {
  const src = join(DIR, "originals", `${name}.png`);
  if (!existsSync(src)) {
    console.warn(`! ${src} not found, skipping ${name}`);
    continue;
  }
  const m = await tip(src, name);
  if (!m.at) throw new Error(`${name}.png: no solid pixels found.`);
  console.log(`${name}: original ${m.w}×${m.h}, tip at ${m.at.map((n) => Math.round(n)).join(", ")}`);

  for (const [s, f] of [["x1", 1], ["x2", 2], ["x3", 3]]) {
    const px = Math.round(size * f);
    const dest = join(DIR, s, `${name}.png`);
    mkdirSync(join(DIR, s), { recursive: true });
    if (px > MAX) {
      if (existsSync(dest)) rmSync(dest);
      console.warn(`  ${s}: ${px} px is over the ${MAX} px browser limit, not written`);
      continue;
    }
    if (px > Math.max(m.w, m.h)) console.warn(`  ${s}: ${px} px is bigger than the original (${m.w} px), it will look soft. Export the original bigger.`);
    await sharp(src)
      .resize(px, Math.round((px * m.h) / m.w), { fit: "fill", kernel: "lanczos3" })
      .png({ compressionLevel: 9 })
      .toFile(dest);
    console.log(`  ${s}: ${px} px  → ${dest.slice(ROOT.length + 1)}`);
  }

  // hotspot in x1 pixels (= CSS px on screen)
  const hs = [Math.round((m.at[0] * size) / m.w), Math.round((m.at[1] * size) / m.w)];
  console.log(`  hotspot: [${hs.join(", ")}]`);
  // ("[^"]*" skips over strings, so the "}" in "{x}" doesn't end the match)
  const re = new RegExp(`("${name}"\\s*:\\s*\\{(?:"[^"]*"|[^}"])*?"hotspot"\\s*:\\s*)\\[[^\\]]*\\]`);
  if (!re.test(out)) throw new Error(`assets.json: couldn't find images.cursor.${name}.hotspot to update.`);
  out = out.replace(re, `$1[${hs.join(", ")}]`);
}

if (out !== json) {
  writeFileSync(ASSETS, out);
  console.log("Updated hotspots in public/content/assets.json");
}
