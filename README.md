# The Forgotten Heroes: A Discovery

Interactive galaxy site for the NASA "Abandoned but not Forgotten" challenge.
React + Vite + Tailwind + Motion. Builds to a plain static site (Netlify / GitHub Pages).

---

## 1. View it on your computer

Needs Node.js 20+ (https://nodejs.org).

    npm install
    npm run dev

Open the link it prints (usually http://localhost:5173). Edits reload instantly.

> Opening `index.html` by double-clicking will NOT work — the site loads its text from
> JSON files, which browsers block on `file://`. Always use `npm run dev` (or a deployed URL).

---

## 2. Edit the story, descriptions and quizzes — no code needed

Everything the user reads lives in **`public/content/`**:

| File | What's in it |
|---|---|
| `theme.json` | site title, Nova's name |
| `assets.json` | where every image and sound comes from (usually no need to touch) |
| `nova.json` | Nova's expressions (which eyes / brows / mouth file each mood uses) |
| `story.json` | Nova's dialogs: `intro`, `bonusUnlocked`, `ending`, and the `credits` (team names) |
| `planets.json` | planet names/colours/images, **which equipment is on which planet**, and the bonus equipment |
| `equipment/<id>.json` | one file per equipment: speech bubble, description/conversation script, "i" info, quiz |

### A dialog line (story.json)
```json
{ "expression": "excited", "body": "point", "showPoints": true, "text": "Collect all {goal} points up here!" }
```
- `expression`: Nova's face, any name from `nova.json` (neutral, happy, excited, sad, confused,
  surprised, angry, curious, worried, smug, content, laughing)
- `body`: `arm-down` · `wave` · `point` (keep `point` on the `showPoints` line, since she points at the counter)
- `showPoints`: reveals and pulses the points counter (top-right)
- `button`: shows a button on that line, e.g. `"button": "I'm ready!"`
- placeholders: `{name}` (Nova), `{goal}` (total points), `{points}` (current points)

### An equipment script (equipment/*.json)
The `script` is a list of lines, played in order. Clicking **anywhere** on the screen (or Enter /
Space / →) finishes the line that's typing; the next click shows the next line. Buttons, links, the
"i" button, the points counter and the info popup don't advance the dialog. Lines with a `button`
wait for that button. While a line waits for a click, a faint "Click anywhere to continue" shows at
the bottom of the screen. The same goes for Nova's lines in `story.json`.
```json
"script": [
  { "speaker": "narrator",  "text": "A description in the bottom panel." },
  { "speaker": "scientist", "text": "Nova pops in to ask something.", "expression": "curious" },
  { "speaker": "equipment", "text": "The equipment answers in its speech bubble." },
  { "speaker": "narrator",  "text": "Another description. Nova leaves automatically." }
]
```
- **Add** a line: copy one and paste it where you want it (mind the commas).
- **Delete** a line: remove it (and its comma).
- `speaker: "scientist"` is Nova. Scientist + equipment lines next to each other = a back-and-forth conversation.

### Formatting inside a "text"
Any dialog `text` (story.json lines, equipment script lines, greetings) can use these tags:

| Tag | Looks like |
|---|---|
| `<i>…</i>` | italic |
| `<b>…</b>` | bold |
| `<small>…</small>` | smaller (~85 %) |
| `<chorus>…</chorus>` | **the other connected equipment speaking**: starts on a new line in the same bubble, italic, ~88 % size, a bit faded |

```json
{ "speaker": "equipment", "text": "Hah, tell us about it. <chorus>Hmph… Can't believe them… We're still here! Still standing!</chorus>" }
```
- Tags can be nested, e.g. `<chorus><b>Still standing!</b></chorus>`.
- Only the text types out (tags never show). Clicking still finishes the line at once.
- While a `<chorus>` part types, the equipment's voice plays quieter and a little lower, like another
  speaker further away. To give the chorus a different voice on one line, add
  `"chorusVoice": "assets/mp3/vocal/equipment/equipment_medium_pitch"` to that line.
- Any other `<…>` (or a lone `<`) is shown as plain text. A tag that isn't closed, or is closed in
  the wrong order (`<b><i>…</b></i>`), shows in the red error box with the file, line and tag.
- The look of each tag is in `src/components/galaxy/galaxy.css` (`.dialog-i`, `.dialog-b`,
  `.dialog-small`, `.dialog-chorus`).

### A quiz
```json
"quiz": {
  "points": 10,
  "questions": [
    { "question": "…?", "options": ["A text", "B text", "C text", "D text"], "answer": "C",
      "explanation": "Shown after a correct answer." }
  ]
}
```
- Add more objects to `questions` for multi-question quizzes. All must be right to earn the points
  (awarded once, after the last question).
- A **wrong answer** plays the "wrong" sound and shows "Not quite! Have another look and try this
  question again." **Try again** retries only that question: earlier questions stay answered, and the
  wrong option stays crossed out and can't be picked again. **Read again** goes back to the start of
  the equipment's script; when the player reaches the quiz again it resumes at the same question
  (the progress is kept until they leave the equipment). **Replay quiz** (after passing) starts again
  from question 1 and never awards the points twice.
- **The 60-point goal is calculated automatically** (sum of all planet quizzes). Add a 7th equipment
  worth 10 and the goal becomes 70. The bonus is set to `"points": 0`.

### The "i" info card (`moreInfo`)
Every field is optional.
```json
"moreInfo": {
  "image": "",
  "imageCredit": "Photo: NASA",
  "text": "The summary paragraph under the title.",
  "funFacts": ["One short fact per bullet.", "Another fact."],
  "sources": [
    "https://science.nasa.gov/mission/viking-1/",
    { "label": "NASA NSSDCA: Viking 1 Lander", "url": "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C" }
  ]
}
```
- Card layout, top to bottom: photo (16:9) with `imageCredit` under it, the title + `text`,
  "Fun facts" (hidden if `funFacts` is missing or empty), then "Sources" in small grey text
  (hidden if `sources` is missing). Everything under the photo scrolls inside the card when it's long.
- `image`: see "Add a new piece of equipment" below (empty = the default `real_equipment` photo(s)).
- `sources`: a plain web address shows as the site name (`science.nasa.gov` → "NASA Science",
  `nssdc.gsfc.nasa.gov` → "NASA NSSDCA", other sites → their address, e.g. `example.org`), with the full
  address as the tooltip. Use `{ "label", "url" }` to choose the text yourself. Links open in a new tab.
  More site names: `SITE_NAMES` in `src/content/load.ts`.
- `funFacts` must be texts in quotes and every source must start with `http://` or `https://`;
  anything else shows in the red error box with the file and item number.

### The equipment

| Planet | Equipment | File (`content/equipment/…json`) |
|---|---|---|
| Moon | Apollo Lunar Modules | `apollo-lunar-modules` |
| Moon | Lunar Roving Vehicles (LRVs) | `lunar-roving-vehicles` |
| Moon | ALSEP Scientific Packages | `alsep` |
| Mars | Spirit & Opportunity | `spirit-and-opportunity` |
| Mars | Viking 1 Lander | `viking-1-lander` |
| Mars | InSight Lander | `insight-lander` |
| Bonus (open space) | Pioneer 10 | `pioneer-10` (0 points) |

Their text is still `[TODO: …]` placeholders: fill in the greeting, script, `moreInfo` and quiz. Each has one narrator, one Nova and one equipment line to start from. `equipment/_examples/` holds the old fully written examples (Lunar Rover, Snoopy, …) to copy from; the site ignores that folder.

### Add a new piece of equipment
1. Copy one of the files in `public/content/equipment/` (or a fully written example from `equipment/_examples/`) → `public/content/equipment/my-thing.json` and edit it.
2. Add `"my-thing"` to a planet's `equipment` list in `planets.json`.
3. Put its drawn art in `public/assets/image/equipment/x1/` named `my-thing` (.jpg/.png/…), plus x2/x3 if you have them. Use the exact id, lower case, no spaces: GitHub Pages is case-sensitive.
4. Optional: real photos for its "i" card in `public/assets/image/real_equipment/x1/`: `my-thing.jpg`, or `my-thing-1.jpg`, `my-thing-2.jpg`, … for a gallery. Add `"imageCredit": "Photo: NASA"` to its `moreInfo`.

The bonus equipment stays hidden until **every** planet quiz is passed (logic in `GalaxyExperience.tsx`,
`allDone`). Change which one it is in `planets.json → bonus`.

### Equipment art size when zoomed in
On the planet surface the drawing sits in its small square slot as before. When you open an
equipment (screen 4) the frame zooms in and the drawing grows a bit more inside it, with the same
spring, so it fills ~85–90 % of the frame's height (`object-fit: contain`, never cropped or stretched).
- `EQUIPMENT_ART_SCALE_ZOOMED` in `src/components/galaxy/config.ts` (default `1.2`) sets that extra
  zoom for every equipment.
- `"imageScale": 1.15` at the top level of one equipment's JSON multiplies it for that drawing only
  (bigger for a drawing with lots of empty space, e.g. `1.15`; smaller, e.g. `0.9`, if it gets cut off).
  Allowed: 0.5–3; default 1.
- `npm run trim-equipment` (optional) cuts the transparent border off every drawing and re-pads each
  scale to a square (600 / 1200 / 1800) with ~5 % margin, so all drawings look the same size.
  It **overwrites** the PNGs: commit first. `npm run trim-equipment -- alsep viking-1-lander` does only those.

### Made a typo in the JSON?
The site shows a red box telling you which file and what's wrong (e.g. a missing comma, or an
`answer` letter that doesn't match an option). Tip: edit in VS Code — it highlights JSON mistakes.

---

## 3. Swap the artwork — `public/assets/image/`

Just drop files into the folder **with the expected names** — the extension doesn't matter
(`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg`) and neither does upper/lower case. No code or JSON
edits needed. The full list of names is in `public/assets/image/README.txt`; the paths themselves can
be changed in `public/content/assets.json`.

### Resolution folders: `x1` / `x2` / `x3`
Every image group has three folders. Put the **same file name** in each:

| Folder | Size |
|---|---|
| `x1/` | base size, e.g. 1920×1080 |
| `x2/` | 2× the pixels of x1, e.g. 3840×2160 |
| `x3/` | 3× the pixels of x1, e.g. 5760×3240 |

Example: `planets/x1/moon.png`, `planets/x2/moon.png`, `planets/x3/moon.png`.
**x1 alone is enough to work.** The site preloads x1 so it starts fast, then measures how big each
image is actually shown (× the screen's pixel density) and swaps in x2/x3 only where needed, such as
on high-DPI screens or when zooming into a planet or equipment. The bigger file is loaded in the
background and swapped in once it's ready, so you never see a flash. Files for the zoom targets are
fetched in idle time before you zoom. In `assets.json`, `{x}` in a path stands for the scale folder.

| Image | File | Format |
|---|---|---|
| Background | `background/{x}/background` | JPEG fine |
| Planets | `planets/{x}/earth`, `moon`, `mars` | JPEG fine (cropped to a circle) |
| Equipment (drawn) | `equipment/{x}/<id>` | **Square, transparent PNG**: x1 600×600, x2 1200×1200, x3 1800×1800, equipment centred with ~5–10 % margin (sits in the gold frame) |
| Equipment (real photos) | `real_equipment/{x}/<id>` or `<id>-1`, `<id>-2`, … | **Cropped to exactly 16:9**: x1 800×450, x2 1600×900, x3 2400×1350. JPEG fine. Fills the "i" card's 16:9 picture area edge to edge (several = a gallery). None = the drawn art, shown whole on a dark background |
| Rocket | `rocket/{x}/rocket` (resting) + `rocket/{x}/rocketboost` (boosters firing), pointing straight up | **PNG/WebP**, needs transparency. Both on the **same canvas** (x1 200×584) with the body in the same place. The boosters version shows while the rocket moves and while hovering a planet |
| Starfield | one big image in `stars/{x}/` (see below) | **WebP/PNG with transparency** |
| Nova | `nova/{x}/body`, `eyes`, `brows`, `mouth` (see below) | **PNG/WebP** |
| Research-points icon | any one file in `research_points/{x}/` | **PNG/WebP** |
| Cursor | `cursor/originals/idle`, `tap` (big), run `npm run cursors` | **PNG** |

> **JPEG has no transparent background.** A JPEG rocket or Nova shows up as a rectangle.
> Use PNG or WebP for anything that floats over the background.

### Nova (layered sprite: expressions, blinking, talking)
Nova is drawn in layers, bottom to top: **body → mouth → eyes → brows**. Every layer is a
full-size transparent PNG on **the same canvas size as the bodies** (in Figma: one frame the size of
the whole character, toggle layers, export each), so they line up when stacked.

| Folder | What |
|---|---|
| `nova/{x}/body/` | one file per pose: `arm-down`, `wave`, `point` (drawn without a face) |
| `nova/{x}/eyes/` | one file per eye shape; `closedown` is used for blinking |
| `nova/{x}/brows/` | one file per brow shape |
| `nova/{x}/mouth/` | one file per mouth shape |

**`public/content/nova.json`** turns those files into expressions. Each expression picks one eyes,
brows and mouth file by name (no extension; case, spaces and dashes don't matter):
```json
"happy": { "eyes": "cheery", "brows": "happy", "mouth": "smile", "talkMouths": ["open-smile", "big-smile"] }
```
- `mouth` is her mouth when she's quiet. While her text types, it flips between that and the
  `talkMouths` (or the shared `talk.mouths`), and returns to `mouth` when typing stops.
- She blinks every few seconds with `blink.eyes`. Put `"blink": false` on an expression whose eyes
  are already closed.
- **Use one in a line:** add `"expression": "happy"` and/or `"body": "wave"` to any line in
  `story.json`, or to a `"speaker": "scientist"` line in an equipment script. Lines without them use
  `defaultExpression` / `defaultBody`. The old `"pose"` names still work (`poses` in nova.json maps
  them to bodies).
- **Add an expression:** copy one in nova.json, rename it, pick other files.
- A wrong expression or body name shows the red box with the valid names. A file named in nova.json
  that isn't in the folder shows in the dev-only "missing files" box.

### Starfield (`stars/{x}/`)
One big star layer, bigger than the screen, drifting slowly and endlessly behind everything (above
the background) on every screen. It doesn't need to tile: it's repeated as original + mirrored copy,
which always matches at the edges. Speed, direction, opacity and the biggest resolution used are in
`STARFIELD` in `config.ts`. With "reduce motion" on in the OS, it stands still.

**Export tips:** the stars are soft, so they don't need many pixels, and x1 alone is plenty. Use **WebP
with transparency** at about 1.5× the screen (e.g. 2880×1620) for x1. The site never loads more than x2
for the stars. A 11400×6414 x3 takes ~290 MB of graphics memory when decoded, so leave x3 out.
Background: **JPEG or WebP**, 1920×1080 (x1) and 3840×2160 (x2) cover almost every screen.

### Research-points icon and cursor
- The research-points icon replaces the old star everywhere: the points counter, the quiz header,
  the "Collect Research Points" button, the quiz-complete screen and the credits.
- The cursor uses native CSS cursors, so there's no lag. `idle` is the normal cursor. `tap` shows over
  anything clickable, while pressing on it, and while pressing anywhere when a dialog waits for a click.
  **To change the cursor:** put big exports (e.g. 384×384 PNG) in `cursor/originals/idle.png` and
  `tap.png`, set the on-screen size in `assets.json → images.cursor.size` (CSS px, default 42), then
  run **`npm run cursors`**. It writes x1 (= size), x2 (2×) and x3 (3×) and measures the click point
  ("hotspot": pointer tip for idle, finger tip for tap) into `assets.json`. Browsers ignore cursor
  images over 128 px, so 42 is the largest size where x3 (126 px) still works; bigger sizes skip x3.
  Touch screens have no cursor, so nothing changes there. Clickable things are marked in one place: `galaxy.css` styles
  `button`, `a`, `[role=button]` and `[data-clickable]`.

Positions, sizes and timings: `src/components/galaxy/config.ts` (Nova's size: `NOVA_SCALE`; her dialog bubbles follow it automatically).
Fonts: the `<link>` in `index.html` and the variables in `src/components/galaxy/galaxy.css`.

### Fonts (`public/assets/fonts/`)

| Font | File | Used for |
|---|---|---|
| **Neoteric** (Bold) | `NEOTERIC╕ - Bold DEMO VERSION.ttf` (+ `.woff2`) | **only** the typewriter title on the title screen |
| **Electrolize** (Regular) | `Electrolize-Regular.ttf` (+ `.woff2`) | everything else: dialogs, name labels, panel, quiz, points, pills, "i" card, buttons, credits, loading / error screens |

- The `@font-face` rules are at the top of `src/components/galaxy/galaxy.css`; `--font-title` and
  `--font-ui` there say which font is which. `index.html` preloads both `.woff2` files.
- The `.woff2` copies are ~70 % smaller and load first; the `.ttf` is the fallback. Make them with
  **`npm run fonts`** (re-run after changing a font file).
- Electrolize has only one weight, so nothing uses bold (a fake browser bold looks smeared).
  Emphasis is done with colour, size and letter-spacing instead: `<b>` in a dialog = deep blue with a
  little spacing; name labels and the quiz header = uppercase + wider spacing.
- Symbols Electrolize doesn't have (… ✓ ✕ ◂ ↻ →) are drawn from the system font automatically.
- **Swap a font:** drop the new file in `public/assets/fonts/`, run `npm run fonts`, then update the
  file name in the `@font-face` `src` (galaxy.css) and the `preload` link (index.html). File names are
  case-sensitive on GitHub Pages; spaces and special characters must be URL-encoded (`%20` = space).
  Keep the `font-family` name, or change it in `--font-title` / `--font-ui` and in `font="700 1em Neoteric"`
  (the title waits for that font before typing, in `GalaxyExperience.tsx`). If the title gets
  wider or narrower, tune `font-size` in `.title-font` (now 4.6cqw ≈ 75 % of the stage).
- The Neoteric file is a **demo version**: check its licence before publishing. Electrolize is
  SIL Open Font License (free to use).

---

## 4. Sounds — `public/assets/mp3/`

Same idea: drop files in with the expected names (`.mp3`, `.ogg`, `.wav`, `.m4a`; **lower case**,
the live site is case-sensitive). The list is also in `public/assets/mp3/README.txt`. Every path
lives in `public/content/assets.json → sounds` (keys below), so you can point a key at another file.

### Music (`music/`): four looping tracks that follow the screen

| Track (`sounds.music.…`) | File | Plays on |
|---|---|---|
| `normal` | `music/normal_bg` | title, Nova's intro, planet selection, bonus announcement, Pioneer 10's story (open space), ending, credits |
| `moon` | `music/moon_bg` | the Moon surface and every Moon equipment screen, until its quiz starts |
| `mars` | `music/mars_bg` | the Mars surface and every Mars equipment screen, until its quiz starts |
| `quiz` | `music/quiz_bg` | every quiz (Pioneer 10's too), from when the quiz panel appears until you leave it |

Tracks crossfade in about 0.7 s. Each track carries on where it left off when you come back to it
(Moon → quiz → back to the Moon doesn't restart the Moon music). The mute button pauses all music.
The track is chosen in `GalaxyExperience.tsx` (one `useEffect` → `sound.setMusic()`).

How it works (`src/audio/music.ts`): one controller owns one `<audio>` per track, each routed
through Web Audio (track gain → master gain), and every fade runs on the gain nodes, because
iPads/iPhones ignore `<audio>.volume`. There is a single "target" track. Every change moves all
tracks toward their level (target up, everything else to 0) and pauses a track once it reaches 0,
so after a crossfade only one track is ever playing, however fast you click. In dev, type
`__music()` in the browser console to see each track (playing/paused, gain, time); track changes
are logged as `[music] moon → quiz`.

Loudness: `sounds.volume.music` is the overall music volume. A track can be written as
`{ "file": "…", "volume": 0.5 }` to make just that one quieter (< 1) or louder (> 1). The four
files were mastered at very different levels, so each has its own multiplier.

### Effects

| Event | `assets.json` key | File |
|---|---|---|
| every button click (incl. back, "i", mute, credits) and clicking to continue a dialog | `buttons.click`, `buttons.back` | `buttons/button_click` |
| hovering a planet / equipment | `buttons.hover` | `buttons/hover` |
| right answer | `game.correct` | `game/successfully_completed_quiz` |
| wrong answer | `game.wrong` | `game/failed_quiz` |
| "Collect Research Points" | `game.points` | `game/points_collection` |
| title letters / bonus appears | `game.titleTyping`, `game.bonusAppears` | `game/typewriter`, `game/bonus` |
| title → intro, → ending, → credits | `transitions.titleToIntro`, `toEnding`, `toCredits` | `transitions/fade` |
| intro → planets, zoom into a planet / equipment, zoom back out | `transitions.introToPlanets`, `zoomIn`, `zoomOut` | `transitions/transition_between_planets_equipment` |

The answer buttons and "Collect Research Points" don't play a click, so you only hear their own sound.

### Voices (`vocal/`)

- **Nova** (`voices.scientist` → `vocal/scientist/`): a folder of short blips (~0.05–0.15 s). While her
  line types, a random blip plays every 2nd letter (`voiceEveryNLetters`) with a slightly random pitch.
- **Equipment**: each machine has one voice file, a few seconds of 8-bit "babble". Each **word** plays
  a word-length slice of it from a random spot (slightly random pitch). A new word cuts off the
  previous one, and finishing or skipping the line stops it. (Clips longer than 0.3 s are treated this
  way; short blips work like Nova's.)

| Equipment (id) | Voice file |
|---|---|
| Apollo Lunar Modules (`apollo-lunar-modules`) | `vocal/equipment/equipment_low_pitch` |
| Viking 1 Lander (`viking-1-lander`) | `vocal/equipment/equipment_low_pitch` |
| Lunar Roving Vehicles (`lunar-roving-vehicles`) | `vocal/equipment/equipment_high_pitch` |
| Spirit & Opportunity (`spirit-and-opportunity`) | `vocal/equipment/equipment_high_pitch` |
| ALSEP Scientific Packages (`alsep`) | `vocal/equipment/equipment_medium_pitch` |
| InSight Lander (`insight-lander`), Pioneer 10 (`pioneer-10`) | `vocal/equipment/equipment_normal` |

**Give an equipment its own voice:** add `"voice": "assets/mp3/vocal/equipment/<file>"` (no extension
needed) to `public/content/equipment/<id>.json`. Equipment without a `"voice"` uses the default,
`sounds.voices.equipment` in `assets.json` (= `equipment_normal`). A misspelled voice path is listed
in the dev-only "Missing asset files" box.

There's a mute button bottom-left (remembered per browser).

> **Sound starts on the first click/tap/key.** Browsers block audio until the visitor interacts with
> the page. The site opens straight on the title screen, so the title-typing sound (and anything else
> before the first click, tap or key press) is silent, with no error. From the first interaction on,
> all sounds play and the current screen's music starts. Clicking "Skip intro →" or anywhere on the
> screen counts. `normal_bg` starts downloading straight away; the other tracks load in idle time
> once the game is running.

---

## 5. Deploy

### Netlify
Push to GitHub → Netlify **Add new site → Import from Git**. `netlify.toml` already sets
build = `npm run build`, publish = `dist`. (Or run `npm run build` and drag the `dist/` folder onto
https://app.netlify.com/drop.)

### GitHub Pages
1. Push this folder to a GitHub repo (branch `main`).
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` deploys automatically (`.github/workflows/deploy.yml`).
   Site: `https://<username>.github.io/<repo-name>/`

Either way, editing a JSON file on GitHub and committing redeploys the site with the new text.

---

## Code map
```
public/content/            ← all text (JSON)
public/assets/image/       ← all artwork
public/assets/mp3/         ← all sounds
src/audio/sound.ts         sound effects, voices, music, mute
src/content/assets.ts      finds files by name in public/assets/
src/content/load.ts        loads + checks the JSON
src/components/galaxy/
  GalaxyExperience.tsx     scenes, transitions, points, bonus unlock
  StoryDialog.tsx          Nova's intro / bonus / ending dialogs
  EquipmentScene.tsx       screen 4: script runner, speech bubbles, "i" popup, hint
  Quiz.tsx                 A/B/C/D quiz
  DialogBubble.tsx         typing dialog box that grows with its text
  advance.tsx              "click anywhere to continue" (one stage-level click/key handler)
  Scientist.tsx            Nova: layered body / mouth / eyes / brows, blinking + talking
  ScaledImg.tsx            x1/x2/x3 picking + pre-warming
  PointsIcon.tsx, cursor.ts  research-points icon, custom cursor
  Planet.tsx, Rocket.tsx, EquipmentFrame.tsx, PointsHud.tsx
  config.ts                layout + timing
src/components/ui/typewriter-effect.tsx   Aceternity typewriter (+ onComplete)
```
