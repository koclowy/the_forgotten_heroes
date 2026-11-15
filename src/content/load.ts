import { baseOf, loadAssetIndex, many, missing, scaled, scaledFolder, type Scaled } from "./assets";
import { parseRich } from "./richText";
/**
 * Loads everything in public/content/ at runtime and checks it.
 * Because the JSON is fetched (not bundled), editing a JSON file never needs
 * a code change — just refresh (dev) or redeploy (Netlify / GitHub Pages).
 */
export type Pose = "idle" | "talk" | "wave" | "point";
export type PlanetId = "earth" | "moon" | "mars";
export const PLANET_IDS: PlanetId[] = ["earth", "moon", "mars"];

/** What Nova looks like on a line: an expression from nova.json and a body (or an old pose name). */
export type NovaLook = { expression?: string; body?: string; pose?: Pose };
export type StoryLine = NovaLook & { text: string; showPoints?: boolean; button?: string };
export type ScriptLine = NovaLook & {
  speaker: "narrator" | "scientist" | "equipment";
  text: string;
  /** optional voice for this line's <chorus> parts (path in the JSON, resolved to URLs on load) */
  chorusVoice?: string;
  chorusVoiceUrls?: string[];
};
export type Question = { question: string; options: string[]; answer: string; explanation?: string };
/** A link under "Sources" in the "i" card. */
export type Source = { label: string; url: string };

export type Equipment = {
  id: string;
  name: string;
  /** resolved URLs (x1/x2/x3) */
  image?: Scaled;
  /** extra zoom for the drawing when the frame is zoomed in (× EQUIPMENT_ART_SCALE_ZOOMED), default 1 */
  imageScale: number;
  /** voice blip URLs (own folder, or the default equipment voice) */
  voice: string[];
  greeting: string;
  script: ScriptLine[];
  /** "i" card: real photos (empty = show the equipment art), optional credit line, text, fun facts, sources */
  moreInfo: { images: Scaled[]; imageCredit?: string; text: string; funFacts: string[]; sources: Source[] };
  quiz: { points: number; questions: Question[] };
};

/** One of Nova's moods: a file name from each layer folder (lower-case, no extension). */
export type NovaExpression = { eyes?: string; brows?: string; mouth?: string; talkMouths: string[]; blink: boolean };

/**
 * Nova, the layered sprite. Every layer is a full-size transparent PNG on the same canvas
 * as the bodies, stacked body → mouth → eyes → brows. Names are lower-case file names.
 */
export type NovaArt = {
  layers: Record<"body" | "eyes" | "brows" | "mouth", Record<string, Scaled>>;
  expressions: Record<string, NovaExpression>;
  defaultExpression: string;
  defaultBody: string;
  /** old pose names (idle / talk / wave / point) → body */
  poseAliases: Record<string, string>;
  /** closed eyes for blinking (+ optional half-closed frame per open-eyes file); undefined = no blinking */
  blink?: { closed: string; half: Record<string, string> };
};

export type Content = {
  theme: {
    title: string;
    scientistName: string;
  };
  art: {
    background?: Scaled;
    rocket?: Scaled;
    /** the same rocket with its boosters firing (same canvas as `rocket`) */
    rocketBoost?: Scaled;
    /** the one big drifting star layer */
    stars?: Scaled;
    nova: NovaArt;
    researchPoints?: Scaled;
    /** size = on-screen size in CSS px (x1 is exported at this size) */
    cursor: { size: number } & Partial<Record<"idle" | "tap", { image: Scaled; hotspot: [number, number] }>>;
  };
  /** sound key ("buttons.click", "voices.scientist"…) → candidate URLs */
  sounds: Record<string, string[]>;
  soundSettings: {
    /** background tracks by name (normal / moon / mars / quiz); volume = optional per-track multiplier */
    music: Record<string, { urls: string[]; volume?: number }>;
    volume: { music: number; effects: number; voices: number };
    voiceEvery: number;
  };
  planets: Record<PlanetId, { name: string; image?: Scaled; color?: string; equipment: string[] }>;
  bonusId: string | null;
  story: {
    intro: StoryLine[];
    bonusUnlocked: StoryLine[];
    ending: StoryLine[];
    credits: { heading: string; subheading?: string; names: string[]; note?: string; restart?: string };
  };
  equipment: Record<string, Equipment>;
  /** total points available (bonus excluded automatically if it's worth 0) */
  goal: number;
};

const base = import.meta.env.BASE_URL;

class ContentError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(problems.join("\n"));
    this.problems = problems;
  }
}
export { ContentError };

async function getJson(path: string) {
  const res = await fetch(`${base}content/${path}`, { cache: "no-cache" });
  if (!res.ok) throw new ContentError([`content/${path}: file not found (HTTP ${res.status}).`]);
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new ContentError([`content/${path}: not valid JSON — ${(e as Error).message}. (Check for a missing comma or quote, or a trailing comma.)`]);
  }
}

const LETTERS = "ABCDEFGH";

const POSES: Pose[] = ["idle", "talk", "wave", "point"];
const NOVA_LAYERS = ["body", "eyes", "brows", "mouth"] as const;

/** "Arm Down" / "arm-down" / "arm_down" → "arm-down" (how names are matched) */
export const normName = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-");

/** Reads nova.json + the layer folders. Problems (unknown names in nova.json) go to `problems`. */
function loadNova(novaJ: any, paths: any, problems: string[]): NovaArt {
  const layers = {} as NovaArt["layers"];
  for (const l of NOVA_LAYERS) {
    layers[l] = {};
    for (const f of scaledFolder(paths?.[l])) layers[l][normName(f.name)] = f.v;
  }
  const where = "content/nova.json";
  const names = (l: (typeof NOVA_LAYERS)[number]) => Object.keys(layers[l]);
  // a layer file named in nova.json that isn't in the folder → dev-only "missing files" box
  const ref = (l: (typeof NOVA_LAYERS)[number], name: unknown, what: string) => {
    if (name === undefined || name === null || name === "") return undefined;
    const n = normName(name);
    if (!layers[l][n]) {
      const dir = String(paths?.[l] ?? `assets/image/nova/{x}/${l}/`).replace("{x}", "x1");
      missing.push(`${dir}${name}.png  (nova.json → ${what}; found: ${names(l).join(", ") || "nothing"})`);
      return undefined;
    }
    return n;
  };

  const talkDefault = (Array.isArray(novaJ.talk?.mouths) ? novaJ.talk.mouths : [])
    .map((m: unknown) => ref("mouth", m, "talk.mouths"))
    .filter(Boolean) as string[];
  const blinkEyes = ref("eyes", novaJ.blink?.eyes, "blink.eyes");
  const half: Record<string, string> = {};
  for (const [open, h] of Object.entries(novaJ.blink?.half ?? {})) {
    const o = ref("eyes", open, "blink.half");
    const hh = ref("eyes", h, "blink.half");
    if (o && hh) half[o] = hh;
  }

  const expressions: Record<string, NovaExpression> = {};
  for (const [name, e] of Object.entries<any>(novaJ.expressions ?? {})) {
    if (name.startsWith("_")) continue;
    const k = normName(name);
    const own = Array.isArray(e?.talkMouths)
      ? (e.talkMouths.map((m: unknown) => ref("mouth", m, `${name}.talkMouths`)).filter(Boolean) as string[])
      : null;
    expressions[k] = {
      eyes: ref("eyes", e?.eyes, `${name}.eyes`),
      brows: ref("brows", e?.brows, `${name}.brows`),
      mouth: ref("mouth", e?.mouth, `${name}.mouth`),
      talkMouths: own ?? talkDefault,
      blink: e?.blink !== false,
    };
  }
  if (!Object.keys(expressions).length) {
    problems.push(`${where}: "expressions" needs at least one expression.`);
    expressions.neutral = { talkMouths: talkDefault, blink: true };
  }

  const bodies = names("body");
  if (!bodies.length) missing.push(`${String(paths?.body ?? "assets/image/nova/{x}/body/").replace("{x}", "x1")}  (Nova's body images)`);
  let defaultExpression = normName(novaJ.defaultExpression);
  if (!expressions[defaultExpression]) {
    if (novaJ.defaultExpression)
      problems.push(`${where}: defaultExpression "${novaJ.defaultExpression}" isn't an expression. Use one of: ${Object.keys(expressions).join(", ")}.`);
    defaultExpression = Object.keys(expressions)[0];
  }
  let defaultBody = normName(novaJ.defaultBody);
  if (!layers.body[defaultBody]) {
    if (novaJ.defaultBody && bodies.length)
      problems.push(`${where}: defaultBody "${novaJ.defaultBody}" isn't a body. Use one of: ${bodies.join(", ")}.`);
    defaultBody = bodies[0] ?? "";
  }
  const poseAliases: Record<string, string> = {};
  for (const p of POSES) {
    const b = normName(novaJ.poses?.[p]);
    poseAliases[p] = layers.body[b] ? b : layers.body[p] ? p : defaultBody;
  }

  return {
    layers,
    expressions,
    defaultExpression,
    defaultBody,
    poseAliases,
    blink: blinkEyes ? { closed: blinkEyes, half } : undefined,
  };
}

/** The research-points icon: a file path, or a folder (ending in /) → its first image. */
function researchPoints(path: string | undefined): Scaled | undefined {
  if (!path) return undefined;
  if (path.trim().endsWith("/")) {
    const v = scaledFolder(path)[0]?.v;
    if (!v) missing.push(`${path.replace("{x}", "x1")}  (any image: the research-points icon)`);
    return v;
  }
  return scaled(path, true);
}

/** Unclosed / mismatched <i> <b> <small> <chorus> tags in a dialog text. */
function checkTags(text: string, where: string, problems: string[]) {
  for (const e of parseRich(text).errors) problems.push(`${where}: ${e}.`);
}

/** Checks a story / script line's "expression" and "body". */
function checkLook(nova: NovaArt, l: NovaLook, where: string, problems: string[]) {
  if (l.expression !== undefined && !nova.expressions[normName(l.expression)])
    problems.push(`${where} has expression "${l.expression}". Use one of: ${Object.keys(nova.expressions).join(", ")} (see content/nova.json).`);
  const bodies = Object.keys(nova.layers.body);
  if (l.body !== undefined && bodies.length && !nova.layers.body[normName(l.body)])
    problems.push(`${where} has body "${l.body}". Use one of: ${bodies.join(", ")}.`);
  if (l.pose !== undefined && !POSES.includes(l.pose))
    problems.push(`${where} has pose "${l.pose}". Use one of: ${POSES.join(", ")} (or "body" instead).`);
}

/** moreInfo.funFacts: optional list of strings. */
function funFacts(v: unknown, where: string, problems: string[]): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    problems.push(`${where}: moreInfo.funFacts must be a list of texts, like ["Fact one.", "Fact two."].`);
    return [];
  }
  const out: string[] = [];
  v.forEach((f, n) => {
    if (typeof f !== "string") problems.push(`${where}: moreInfo.funFacts item ${n + 1} must be a text in quotes, got ${JSON.stringify(f)}.`);
    else if (f.trim()) out.push(f.trim());
  });
  return out;
}

const isHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

/** Friendly names for source sites; anything else shows its host name without "www.". */
const SITE_NAMES: Record<string, string> = {
  "science.nasa.gov": "NASA Science",
  "nssdc.gsfc.nasa.gov": "NASA NSSDCA",
  "nasa.gov": "NASA",
  "mars.nasa.gov": "NASA Mars",
  "jpl.nasa.gov": "NASA JPL",
  "solarsystem.nasa.gov": "NASA Solar System",
  "history.nasa.gov": "NASA History",
  "en.wikipedia.org": "Wikipedia",
  "honeysucklecreek.net": "Honeysuckle Creek",
};
export function siteName(url: string) {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  return SITE_NAMES[host] ?? host;
}

/** moreInfo.sources: optional list of URLs or { "label": "…", "url": "…" }. */
function sources(v: unknown, where: string, problems: string[]): Source[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    problems.push(`${where}: moreInfo.sources must be a list, like ["https://science.nasa.gov/…"] or [{ "label": "NASA", "url": "https://…" }].`);
    return [];
  }
  const out: Source[] = [];
  v.forEach((s, n) => {
    const bad = (why: string) => problems.push(`${where}: moreInfo.sources item ${n + 1} ${why}, got ${JSON.stringify(s)}.`);
    if (typeof s === "string") {
      if (!isHttpUrl(s.trim())) return bad("must be a full web address starting with http:// or https://");
      out.push({ label: siteName(s.trim()), url: s.trim() });
    } else if (s && typeof s === "object" && !Array.isArray(s)) {
      const { label, url } = s as { label?: unknown; url?: unknown };
      if (typeof url !== "string" || !isHttpUrl(url.trim())) return bad(`needs a "url" starting with http:// or https://`);
      if (label !== undefined && typeof label !== "string") return bad(`has a "label" that isn't a text`);
      out.push({ label: label?.trim() || siteName(url.trim()), url: url.trim() });
    } else bad(`must be a web address in quotes or { "label": "…", "url": "…" }`);
  });
  return out;
}

/** Which body + expression Nova shows for a line (falls back to the old pose names, then the defaults). */
export function novaLook(nova: NovaArt, l: NovaLook | undefined) {
  const b = l?.body ? normName(l.body) : l?.pose ? nova.poseAliases[l.pose] : undefined;
  const e = l?.expression ? normName(l.expression) : undefined;
  return {
    body: b && nova.layers.body[b] ? b : nova.defaultBody,
    expression: nova.expressions[e ?? ""] ?? nova.expressions[nova.defaultExpression],
  };
}

export async function loadContent(): Promise<Content> {
  const [themeJ, planetsJ, storyJ, assetsJ, novaJ] = await Promise.all([
    getJson("theme.json"),
    getJson("planets.json"),
    getJson("story.json"),
    getJson("assets.json"),
    getJson("nova.json"),
    loadAssetIndex(),
  ]);
  const problems: string[] = [];
  const img = assetsJ.images ?? {};
  const snd = assetsJ.sounds ?? {};
  const nova = loadNova(novaJ, img.nova, problems);

  // ---------- planets ----------
  const planets = {} as Content["planets"];
  for (const id of PLANET_IDS) {
    const p = planetsJ.planets?.[id];
    if (!p) {
      problems.push(`planets.json: missing planet "${id}".`);
      continue;
    }
    planets[id] = {
      name: p.name ?? id,
      image: scaled(img.planets?.[id]),
      color: p.color || undefined,
      equipment: Array.isArray(p.equipment) ? p.equipment : [],
    };
  }
  const bonusId: string | null = planetsJ.bonus?.equipment || null;
  const ids = [...new Set([...PLANET_IDS.flatMap((id) => planets[id]?.equipment ?? []), ...(bonusId ? [bonusId] : [])])];

  // ---------- equipment ----------
  // (only ids listed in planets.json are loaded, so content/equipment/_examples/ is ignored)
  const files = await Promise.allSettled(ids.map((id) => getJson(`equipment/${id}.json`)));
  // "i" card photos: real_equipment/{x}/<id> and/or <id>-1, <id>-2, …
  const realDir = String(img.realEquipment ?? "assets/image/real_equipment/{x}/").replace(/\/?$/, "/");
  const realPhotos = (path: string): Scaled[] => {
    const p = path.trim();
    const own = scaled(p);
    const dir = p.slice(0, p.lastIndexOf("/") + 1);
    const base = normName(p.slice(p.lastIndexOf("/") + 1).replace(/\.[a-z0-9]+$/i, ""));
    const numbered = scaledFolder(dir)
      .map((f) => ({ ...f, n: Number(normName(f.name).match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`))?.[1]) }))
      .filter((f) => f.n > 0)
      .sort((a, b) => a.n - b.n)
      .map((f) => f.v);
    return [...(own ? [own] : []), ...numbered];
  };
  const equipment: Record<string, Equipment> = {};
  files.forEach((r, i) => {
    const id = ids[i];
    const where = `content/equipment/${id}.json`;
    if (r.status === "rejected") {
      problems.push(...(r.reason instanceof ContentError ? r.reason.problems : [String(r.reason)]));
      return;
    }
    const d = r.value;
    if (!d.name) problems.push(`${where}: "name" is missing.`);
    const script: ScriptLine[] = Array.isArray(d.script) ? d.script : [];
    script.forEach((l, n) => {
      if (!["narrator", "scientist", "equipment"].includes(l.speaker))
        problems.push(`${where}: script line ${n + 1} has speaker "${l.speaker}" — use narrator, scientist or equipment.`);
      if (!l.text) problems.push(`${where}: script line ${n + 1} has no "text".`);
      else checkTags(l.text, `${where}: script line ${n + 1}`, problems);
      if (l.speaker === "scientist") checkLook(nova, l, `${where}: script line ${n + 1}`, problems);
      if (l.chorusVoice) {
        l.chorusVoiceUrls = many(l.chorusVoice, "audio");
        if (!l.chorusVoiceUrls.length) missing.push(`${l.chorusVoice} (mp3/ogg/wav/m4a) — chorusVoice of ${where} line ${n + 1}`);
      }
    });
    if (d.greeting) checkTags(d.greeting, `${where}: "greeting"`, problems);
    const qs: Question[] = Array.isArray(d.quiz?.questions) ? d.quiz.questions : [];
    if (!qs.length) problems.push(`${where}: quiz needs at least one question.`);
    qs.forEach((q, n) => {
      const k = LETTERS.indexOf(String(q.answer).toUpperCase());
      if (!Array.isArray(q.options) || q.options.length < 2)
        problems.push(`${where}: question ${n + 1} needs at least 2 options.`);
      else if (k < 0 || k >= q.options.length)
        problems.push(`${where}: question ${n + 1} answer "${q.answer}" doesn't match an option (A–${LETTERS[q.options.length - 1]}).`);
    });
    equipment[id] = {
      id,
      name: d.name ?? id,
      image: scaled(d.image, true),
      imageScale: (() => {
        if (d.imageScale === undefined || d.imageScale === null || d.imageScale === "") return 1;
        const n = d.imageScale;
        if (typeof n !== "number" || !(n >= 0.5 && n <= 3)) {
          problems.push(`${where}: "imageScale" must be a number between 0.5 and 3 (e.g. 1.15), got ${JSON.stringify(n)}.`);
          return 1;
        }
        return n;
      })(),
      voice: (() => {
        const own = d.voice ? many(d.voice, "audio") : [];
        if (d.voice && !own.length) missing.push(`${d.voice} (mp3/ogg/wav/m4a) — voice of ${where}`);
        return own.length ? own : many(snd.voices?.equipment, "audio");
      })(),
      greeting: d.greeting ?? "",
      script,
      moreInfo: {
        images: realPhotos(d.moreInfo?.image || `${realDir}${id}`),
        imageCredit: d.moreInfo?.imageCredit || undefined,
        text: d.moreInfo?.text ?? "",
        funFacts: funFacts(d.moreInfo?.funFacts, where, problems),
        sources: sources(d.moreInfo?.sources, where, problems),
      },
      quiz: { points: Number(d.quiz?.points ?? 10), questions: qs },
    };
  });

  // ---------- story ----------
  const lines = (k: string): StoryLine[] => {
    const v = storyJ[k];
    if (!Array.isArray(v) || !v.length) {
      problems.push(`story.json: "${k}" needs at least one line.`);
      return [{ text: "…" }];
    }
    return v;
  };
  const story: Content["story"] = {
    intro: lines("intro"),
    bonusUnlocked: bonusId ? lines("bonusUnlocked") : [],
    ending: lines("ending"),
    credits: { names: [], heading: "Thank you!", ...storyJ.credits },
  };
  for (const k of ["intro", "bonusUnlocked", "ending"] as const)
    story[k].forEach((l, n) => {
      checkLook(nova, l, `story.json: ${k} line ${n + 1}`, problems);
      checkTags(l.text ?? "", `story.json: ${k} line ${n + 1}`, problems);
    });

  if (problems.length) throw new ContentError(problems);

  const goal = PLANET_IDS.flatMap((id) => planets[id].equipment).reduce(
    (sum, id) => sum + (equipment[id]?.quiz.points ?? 0),
    0,
  );

  // ---------- cursor ----------
  const cursor: Content["art"]["cursor"] = { size: Number(img.cursor?.size) || 42 };
  for (const k of ["idle", "tap"] as const) {
    const c = img.cursor?.[k];
    const path = typeof c === "string" ? c : c?.image;
    const image = scaled(path);
    const hs = Array.isArray(c?.hotspot) ? c.hotspot.map(Number) : [0, 0];
    if (image) cursor[k] = { image, hotspot: [hs[0] || 0, hs[1] || 0] };
  }

  // ---------- sounds: flatten {group: {name: path}} → "group.name" ----------
  const sounds: Record<string, string[]> = {};
  for (const group of ["buttons", "transitions", "game", "voices"])
    for (const [name, path] of Object.entries(snd[group] ?? {}))
      sounds[`${group}.${name}`] = many(path as string, "audio");
  const vol = snd.volume ?? {};
  // music: { "normal": "path" | { "file": "path", "volume": 0.8 }, … }  (an old single path = "normal")
  const music: Content["soundSettings"]["music"] = {};
  const musicJ = typeof snd.music === "string" ? { normal: snd.music } : (snd.music ?? {});
  for (const [name, v] of Object.entries(musicJ as Record<string, unknown>)) {
    if (name.startsWith("_")) continue;
    const o = (typeof v === "string" ? { file: v } : v) as { file?: string; volume?: number };
    const urls = many(o?.file, "audio");
    if (urls.length) music[name] = { urls, volume: typeof o.volume === "number" ? o.volume : undefined };
    else if (o?.file) missing.push(`${o.file} (mp3/ogg/wav/m4a) — music "${name}"`);
  }

  return {
    theme: {
      title: themeJ.title ?? "The Forgotten Heroes: A Discovery",
      scientistName: themeJ.scientistName ?? "Nova",
    },
    art: {
      background: scaled(img.background),
      rocket: scaled(img.rocket, true),
      rocketBoost: scaled(img.rocketBoost, !!img.rocketBoost),
      // a folder → its first image; a file path → that file
      stars: String(img.stars ?? "").trim().endsWith("/") ? scaledFolder(img.stars)[0]?.v : scaled(img.stars),
      nova,
      researchPoints: researchPoints(img.researchPoints),
      cursor,
    },
    sounds,
    soundSettings: {
      music,
      volume: { music: vol.music ?? 0.3, effects: vol.effects ?? 0.8, voices: vol.voices ?? 0.55 },
      voiceEvery: Math.max(1, Number(snd.voiceEveryNLetters ?? 2)),
    },
    planets,
    bonusId,
    story,
    equipment,
    goal,
  };
}

/** Every image (x1, or the smallest available), for preloading at startup. */
export function allImages(c: Content) {
  return [
    c.art.background,
    c.art.rocket,
    c.art.rocketBoost,
    c.art.stars,
    ...Object.values(c.art.nova.layers).flatMap((g) => Object.values(g)),
    c.art.researchPoints,
    ...PLANET_IDS.map((id) => c.planets[id].image),
    ...Object.values(c.equipment).flatMap((e) => [e.image, ...e.moreInfo.images]),
  ]
    .map(baseOf)
    .filter(Boolean) as string[];
}

/** {name} {goal} {points} placeholders in dialog text. */
export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export const letter = (i: number) => LETTERS[i];
export const answerIndex = (q: Question) => LETTERS.indexOf(String(q.answer).toUpperCase());
