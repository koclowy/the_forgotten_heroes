import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Lists every file in public/assets/ as /assets-index.json, so the site can find
 * "assets/image/moon" whether you saved moon.jpg, moon.png or moon.webp.
 * In dev it's re-scanned on every request (drop a file in, refresh). On build it's written to dist/.
 */
function assetIndex(): Plugin {
  const root = join(process.cwd(), "public");
  const scan = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      if (name.startsWith(".")) return [];
      const full = join(dir, name);
      return statSync(full).isDirectory() ? scan(full) : [relative(root, full).split(sep).join("/")];
    });
  const list = () => JSON.stringify(scan(join(root, "assets")).sort());
  return {
    name: "asset-index",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split("?")[0].endsWith("/assets-index.json")) return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(list());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "assets-index.json", source: list() });
    },
  };
}

// base "./" = relative paths, so the build works on Netlify AND on a
// GitHub Pages sub-folder (username.github.io/repo-name/) without changes.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), assetIndex()],
  // keep the built JS/CSS out of your assets/ folder
  build: { assetsDir: "app" },
});
