import { useEffect, useState } from "react";
import { sound } from "./audio/sound";
import GalaxyExperience from "./components/galaxy/GalaxyExperience";
import { missing, preloadImages } from "./content/assets";
import { allImages, ContentError, loadContent, type Content } from "./content/load";

/** Loads public/content/*.json + finds the files in public/assets/, preloads images, then starts. */
export default function App() {
  const [content, setContent] = useState<Content | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [progress, setProgress] = useState("");
  const [missingFiles, setMissingFiles] = useState<string[]>([]);

  useEffect(() => {
    loadContent()
      .then(async (c) => {
        sound.init(c);
        await Promise.all([
          preloadImages(allImages(c), (d, t) => setProgress(`${d} / ${t}`)),
          // our fonts (galaxy.css), so the first bubbles and the title are measured in them; max 3 s
          Promise.race([
            Promise.all([document.fonts?.load("1em Electrolize"), document.fonts?.load("700 1em Neoteric")]).catch(() => {}),
            new Promise((r) => setTimeout(r, 3000)),
          ]),
        ]);
        if (missing.length) {
          console.warn("[Forgotten Heroes] Missing asset files:\n" + missing.join("\n"));
          if (import.meta.env.DEV) setMissingFiles([...missing]);
        }
        setContent(c);
      })
      .catch((e) => {
        console.error(e);
        setProblems(e instanceof ContentError ? e.problems : [String(e?.message ?? e)]);
      });
  }, []);

  if (problems)
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#161a33] p-8 text-white" style={{ fontFamily: "var(--font-ui)" }}>
        <div className="max-w-2xl rounded-2xl border-2 border-[#E5484D] bg-[#1d2147] p-8">
          <h1 className="mb-2 text-2xl tracking-wide">Something in the content files needs fixing</h1>
          <p className="mb-4 text-white/70">
            Fix these in <code>public/content/</code>, then refresh:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[#FFB3B5]">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    );

  if (!content)
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#161a33] text-white/50" style={{ fontFamily: "var(--font-ui)" }}>
        Loading… {progress}
      </div>
    );

  return (
    <>
      <GalaxyExperience content={content} />
      {missingFiles.length > 0 && (
        // dev-only reminder (never shown on the deployed site)
        <div className="fixed bottom-3 right-3 z-50 max-w-sm rounded-lg bg-[#E5484D] p-3 text-xs text-white shadow-lg">
          <button className="float-right ml-2" onClick={() => setMissingFiles([])} data-sound="none">
            ✕
          </button>
          <b>Missing asset files</b> (dev only):
          <ul className="mt-1 list-disc pl-4">
            {missingFiles.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
