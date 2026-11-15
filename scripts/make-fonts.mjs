/**
 * npm run fonts
 *
 * Makes a .woff2 copy (about 70 % smaller) of every .ttf / .otf in public/assets/fonts/, with the
 * same file name. The site loads the .woff2 first and falls back to the .ttf (see galaxy.css).
 * Run it again after swapping a font file.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import wawoff2 from "wawoff2";

const DIR = join(process.cwd(), "public/assets/fonts");
for (const f of readdirSync(DIR).filter((f) => /\.(ttf|otf)$/i.test(f))) {
  const src = readFileSync(join(DIR, f));
  const out = Buffer.from(await wawoff2.compress(src));
  const name = f.replace(/\.(ttf|otf)$/i, ".woff2");
  writeFileSync(join(DIR, name), out);
  console.log(`${f} (${Math.round(src.length / 1024)} KB) → ${name} (${Math.round(out.length / 1024)} KB)`);
}
