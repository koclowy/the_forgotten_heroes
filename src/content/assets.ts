/**
 * Finds files in public/assets/ using assets-index.json (written by the Vite plugin).
 *   "assets/image/moon"            → the first of moon.jpg / .jpeg / .png / .webp / .gif / .svg that exists
 *   "assets/image/moon.png"        → exactly that file (if it exists)
 *   "assets/mp3/vocal/scientist/"  → every sound in that folder
 *   "assets/image/planets/{x}/moon"  → the same image in x1 / x2 / x3 (see scaled())
 */
const base = import.meta.env.BASE_URL;
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"];
const AUDIO_EXT = ["mp3", "ogg", "wav", "m4a"];
export type Kind = "image" | "audio";

let files: Set<string> | null = null;
let list: string[] = [];
export const missing: string[] = [];

export async function loadAssetIndex() {
  try {
    const res = await fetch(`${base}assets-index.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    list = await res.json();
    files = new Set(list.map((f) => f.toLowerCase()));
  } catch {
    // no index (e.g. files copied by hand without building): trust paths as written
    files = null;
  }
}

const clean = (p: string) => p.trim().replace(/^\.?\//, "");
// encodeURI: file names may contain spaces (e.g. "Arm Down.png")
const url = (p: string) => (/^(https?:|data:)/.test(p) ? p : `${base}${encodeURI(p)}`);
const extOf = (p: string) => p.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
const exts = (k: Kind) => (k === "image" ? IMAGE_EXT : AUDIO_EXT);
const find = (p: string) => (files ? list.find((f) => f.toLowerCase() === p.toLowerCase()) : p);

/** One file. `required` = report it if missing. */
export function one(path: string | undefined, kind: Kind, required = false): string | undefined {
  if (!path) return undefined;
  const p = clean(path);
  if (/^(https?:|data:)/.test(p)) return p;
  let hit: string | undefined;
  if (extOf(p) && exts(kind).includes(extOf(p)!)) hit = find(p);
  else if (!files) hit = `${p}.${kind === "image" ? "png" : "mp3"}`;
  else for (const e of exts(kind)) if ((hit = find(`${p}.${e}`))) break;
  if (!hit && required) missing.push(`${p} (${exts(kind).join("/")})`);
  return hit ? url(hit) : undefined;
}

/** Every file of this kind directly inside a folder (sorted by name). */
export function folder(path: string | undefined, kind: Kind): { name: string; url: string }[] {
  if (!path || !files) return [];
  const dir = clean(path).replace(/\/?$/, "/");
  return list
    .filter((f) => f.startsWith(dir) && !f.slice(dir.length).includes("/") && exts(kind).includes(extOf(f) ?? ""))
    .map((f) => ({ name: f.slice(dir.length).replace(/\.[^.]+$/, "").toLowerCase(), url: url(f) }));
}

/** A path or a folder → list of URLs. */
export function many(path: string | undefined, kind: Kind): string[] {
  if (!path) return [];
  return path.trim().endsWith("/") ? folder(path, kind).map((f) => f.url) : [one(path, kind)].filter(Boolean) as string[];
}

/* ------------------------------------------------------------------ */
/* x1 / x2 / x3 resolution folders                                     */
/* ------------------------------------------------------------------ */

export type Scale = "x1" | "x2" | "x3";
export const SCALES: Scale[] = ["x1", "x2", "x3"];
export const SCALE_FACTOR: Record<Scale, number> = { x1: 1, x2: 2, x3: 3 };
/** The same image in up to three resolutions (x2 = 2x the pixels of x1, x3 = 3x). */
export type Scaled = Partial<Record<Scale, string>>;

const wrap = (u: string | undefined): Scaled | undefined => (u ? { x1: u } : undefined);
const nonEmpty = (v: Scaled) => (Object.keys(v).length ? v : undefined);
/** "assets/image/stars/a" → "assets/image/stars/{x}/a" */
const withScaleDir = (p: string) => p.replace(/([^/]*)$/, "{x}/$1");

/**
 * One image in x1/x2/x3, e.g. "assets/image/planets/{x}/moon".
 * Uses whichever scales exist. Backwards compatible: no scale folder → the old
 * un-scaled file (assets/image/planets/moon) is used as x1. A path without {x}
 * is tried as-is first, then inside {x}/ folders.
 */
export function scaled(path: string | undefined, required = false): Scaled | undefined {
  if (!path) return undefined;
  const p = clean(path);
  if (/^(https?:|data:)/.test(p)) return { x1: p };
  const tpl = p.includes("{x}") ? p : null;
  const fromTpl = (t: string) => {
    if (!files) return wrap(one(t.replace("{x}", "x1"), "image"));
    const v: Scaled = {};
    for (const s of SCALES) {
      const u = one(t.replace("{x}", s), "image");
      if (u) v[s] = u;
    }
    return nonEmpty(v);
  };
  const v = tpl
    ? (fromTpl(tpl) ?? wrap(one(tpl.replace(/\{x\}\/?/, ""), "image")))
    : (wrap(files ? one(p, "image") : undefined) ?? fromTpl(withScaleDir(p)) ?? wrap(one(p, "image")));
  if (!v && required) missing.push(`${(tpl ?? withScaleDir(p)).replace("{x}", "x1")} (${IMAGE_EXT.join("/")})`);
  return v;
}

/**
 * Every image in a scaled folder, e.g. "assets/image/stars/{x}/", matched by file name
 * across x1/x2/x3 (sorted by name, names lower-cased). Falls back to the un-scaled folder.
 */
export function scaledFolder(path: string | undefined): { name: string; v: Scaled }[] {
  if (!path) return [];
  let p = clean(path).replace(/\/?$/, "/");
  if (!p.includes("{x}")) {
    const flat = folder(p, "image");
    if (flat.length) return flat.map((f) => ({ name: f.name, v: { x1: f.url } }));
    p = `${p}{x}/`;
  }
  const byName = new Map<string, Scaled>();
  for (const s of SCALES)
    for (const f of folder(p.replace("{x}", s), "image")) {
      const v = byName.get(f.name) ?? {};
      v[s] = f.url;
      byName.set(f.name, v);
    }
  if (!byName.size) return folder(p.replace(/\{x\}\/?/, ""), "image").map((f) => ({ name: f.name, v: { x1: f.url } }));
  return [...byName.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, v]) => ({ name, v }));
}

/** The smallest available file (x1 if present) — what gets preloaded at startup. */
export const baseOf = (v: Scaled | undefined) => (v ? (v.x1 ?? v.x2 ?? v.x3) : undefined);

/* ------------------------------------------------------------------ */
/* Image loading (shared cache)                                        */
/* ------------------------------------------------------------------ */

type Dims = { w: number; h: number };
const loading = new Map<string, Promise<Dims | null>>();
/** URLs that are downloaded AND decoded, so swapping an <img> to them never flashes. */
export const loadedImages = new Set<string>();
/** natural pixel size of every loaded image */
export const imageDims = new Map<string, Dims>();
// keep a reference so the decoded image stays in memory
const keep = new Map<string, HTMLImageElement>();

export function loadImage(u: string): Promise<Dims | null> {
  let p = loading.get(u);
  if (!p) {
    p = new Promise<Dims | null>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const d = { w: img.naturalWidth, h: img.naturalHeight };
        const done = () => {
          imageDims.set(u, d);
          loadedImages.add(u);
          keep.set(u, img);
          resolve(d);
        };
        img.decode ? img.decode().then(done, done) : done();
      };
      img.onerror = () => resolve(null);
      img.src = u;
    });
    loading.set(u, p);
  }
  return p;
}

/** Load every image (x1) before starting so transitions don't pop in. */
export function preloadImages(urls: string[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  const unique = [...new Set(urls)];
  return Promise.all(
    unique.map(
      (u) =>
        new Promise<void>((resolve) => {
          let over = false;
          const finish = () => {
            if (over) return;
            over = true;
            onProgress?.(++done, unique.length);
            resolve();
          };
          loadImage(u).then(finish);
          setTimeout(finish, 8000);
        }),
    ),
  );
}
