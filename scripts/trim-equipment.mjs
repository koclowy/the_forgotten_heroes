/**
 * npm run trim-equipment            (all drawings)
 * npm run trim-equipment -- alsep   (only these ids)
 *
 * Makes every equipment drawing the same visual size in its frame:
 * for each public/assets/image/equipment/x1|x2|x3/<id>.png it cuts off the transparent border,
 * then pads the drawing back to a square (x1 600×600, x2 1200×1200, x3 1800×1800) with ~5 % empty
 * margin around it, centred. Overwrites the files, so commit (or back up) first.
 * SVG placeholders are skipped.
 */
import { readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = join(process.cwd(), "public/assets/image/equipment");
const SIZE = { x1: 600, x2: 1200, x3: 1800 };
const MARGIN = 0.05;
const only = process.argv.slice(2).map((s) => s.toLowerCase());

for (const [scale, size] of Object.entries(SIZE)) {
  const dir = join(DIR, scale);
  let names;
  try {
    names = readdirSync(dir).filter((f) => /\.png$/i.test(f));
  } catch {
    continue;
  }
  for (const f of names) {
    const id = f.replace(/\.png$/i, "").toLowerCase();
    if (only.length && !only.includes(id)) continue;
    const file = join(dir, f);
    // trim fully transparent pixels (threshold 1 keeps faint anti-aliased edges)
    const { data, info } = await sharp(file).ensureAlpha().trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
    const inner = Math.round(size * (1 - 2 * MARGIN));
    const art = await sharp(data)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const tmp = `${file}.tmp`;
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: art, gravity: "centre" }])
      .png({ compressionLevel: 9 })
      .toFile(tmp);
    renameSync(tmp, file);
    console.log(`${scale}/${f}: drawing ${info.width}×${info.height} → ${size}×${size} (${MARGIN * 100} % margin)`);
  }
}
