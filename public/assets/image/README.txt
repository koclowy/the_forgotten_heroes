DROP YOUR IMAGES HERE. Keep the names; the extension can be .jpg .jpeg .png .webp .gif or .svg
(If two files share a name, .jpg wins over .png, then .webp, then .svg. Upper/lower case doesn't matter.)

RESOLUTION FOLDERS: x1 / x2 / x3
Every group has three folders. Put the SAME file name in each:
  x1/  base size
  x2/  2x the pixels of x1   (e.g. x1 = 1920x1080 -> x2 = 3840x2160)
  x3/  3x the pixels of x1   (e.g. x1 = 1920x1080 -> x3 = 5760x3240)
Example: planets/x1/moon.png, planets/x2/moon.png, planets/x3/moon.png
x1 alone is enough to work. The site starts with x1 and swaps in x2/x3 quietly, only where
the image is shown big enough to need it (high-DPI screens, zooming into a planet/equipment).

background/{x}/background     full-screen background (JPEG fine). None = built-in gradient.
rocket/{x}/rocket             resting rocket, pointing STRAIGHT UP. Needs transparency -> PNG/WebP.
rocket/{x}/rocketboost        the same rocket with its boosters firing. SAME canvas size as rocket
                              (x1 200x584, x2 400x1168, x3 600x1752), body in the same place, so the
                              two line up when the site crossfades between them.
planets/{x}/earth, moon, mars square, planet filling it edge to edge (JPEG fine, cropped to a circle).
                              None = coloured circle (colour set in content/planets.json).
stars/{x}/                    ONE big star layer (WebP/PNG with transparency), bigger than the screen.
                              It drifts slowly behind everything; it's repeated mirrored, so it doesn't
                              need to tile. Soft content: x1 (~2880x1620) is plenty, x3 is never loaded.
equipment/{x}/<id>            the drawn art in the gold frames, <id> = its file name in content/equipment/
                              SQUARE transparent PNG: x1 600x600, x2 1200x1200, x3 1800x1800,
                              equipment centred with ~5-10% empty margin all round.
real_equipment/{x}/<id>       real photo(s) shown in the "i" card. <id>-1, <id>-2, ... = a gallery.
                              Crop to EXACTLY 16:9: x1 800x450, x2 1600x900, x3 2400x1350 (JPEG fine).
                              They fill the card's 16:9 picture area edge to edge (other shapes get
                              their edges cut off). None = the drawn art, shown whole on a dark background.
research_points/{x}/          the research-points icon (any file name; the first image is used). PNG/WebP.
cursor/originals/idle, tap    mouse cursor, exported BIG (PNG, e.g. 384x384). idle = normal,
                              tap = over anything clickable / pressing. Then run:  npm run cursors
                              It writes cursor/x1, x2, x3 at the size from content/assets.json
                              (images.cursor.size, default 42 px) and measures the click points.

NOVA: nova/{x}/body, eyes, brows, mouth
  Every Nova file is a full-size transparent PNG on the SAME canvas size as the bodies
  (export each layer from one Figma frame the size of the whole character), so they line up
  when stacked. Drawn bottom to top:  body -> mouth -> eyes -> brows
  body/    whole character without a face, one file per pose (arm-down, wave, point)
  eyes/    one file per eye shape (one of them closed, used for blinking)
  brows/   one file per brow shape
  mouth/   one file per mouth shape (some open ones are used while she talks)
  Which files make up each expression (happy, sad, ...) is set in content/nova.json.

Paths can be changed in content/assets.json.
