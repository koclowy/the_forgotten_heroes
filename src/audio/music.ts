/**
 * Background music: ONE controller for the whole site.
 *
 * - One <audio> element per track (assets.json → sounds.music: normal / moon / mars / quiz),
 *   created once and reused. Once audio is unlocked, each one is routed
 *   MediaElementAudioSourceNode → GainNode (per track) → master GainNode → speakers.
 *   All fades happen on the GainNodes, because iOS/iPadOS ignores <audio>.volume.
 * - A single target track. setMusic() only changes the target; reconcile() then moves EVERY
 *   track's gain toward its wanted level (target = its volume, all others = 0) over MUSIC_FADE,
 *   overriding any fade in progress. A track is paused once it has faded to 0 (its position is
 *   kept, so coming back resumes it). So once a crossfade finishes, at most one track is audible.
 * - Mute: master gain to 0 and pause everything. Unmute: only the target fades back in.
 * - Dev: window.__music() shows every track's state; track changes are logged.
 */
import type { Content } from "../content/load";

/** crossfade length, seconds */
export const MUSIC_FADE = 0.7;
const DEV = import.meta.env.DEV;

type TrackConfig = Content["soundSettings"]["music"];
type Track = {
  name: string;
  el: HTMLAudioElement;
  /** per-track gain (null until unlocked, or if Web Audio routing failed) */
  gain: GainNode | null;
  /** wanted level when this is the target (music volume × track volume) */
  level: number;
  /** bumps on every reconcile, so an old fade's "pause at 0" timer can't act on a newer fade */
  gen: number;
  pauseTimer?: ReturnType<typeof setTimeout>;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

class MusicController {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** true once the first gesture happened (with or without Web Audio) */
  private unlocked = false;
  private config: TrackConfig = {};
  private volume = 0.3;
  private signature = "";
  private tracks = new Map<string, Track>();
  private target: string | null = null;
  private muted = false;

  /** Track list + music volume from content. Safe to call again (StrictMode, reloads): same config = no-op. */
  configure(config: TrackConfig, volume: number) {
    const sig = JSON.stringify([config, volume]);
    if (sig === this.signature) return;
    this.release(); // different tracks: drop the old elements (never leave one playing)
    this.signature = sig;
    this.config = config;
    this.volume = volume;
    if (this.target && !this.config[this.target]) this.target = this.fallback();
    // the first screen's track starts downloading right away
    if (this.config.normal) this.track("normal");
    if (this.ctx) this.attach(this.ctx);
  }

  /** Start downloading every track (idle time, once the game is running). */
  preloadAll() {
    for (const name of Object.keys(this.config)) this.track(name);
  }

  /**
   * Call inside the first user gesture with the shared AudioContext (null = no Web Audio).
   * Routes every track through Web Audio and "touches" each element so iOS lets it play later
   * (crossfades start outside a click).
   */
  attach(ctx: AudioContext | null) {
    // keep the first context: every track's GainNode lives in it (a second context after a dev
    // hot update would have a different clock)
    if (this.unlocked && (this.ctx || !ctx)) return void this.ensurePlaying();
    this.unlocked = true;
    this.ctx = ctx;
    if (ctx && !this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
    }
    for (const name of Object.keys(this.config)) {
      const t = this.track(name)!;
      if (this.want(t) > 0 || this.muted || !t.el.paused) continue;
      if (!t.gain) t.el.volume = 0; // not routed: keep the touch silent where volume works
      // silent (gain 0) play + pause inside the gesture
      t.el.play().then(
        () => this.want(t) === 0 && t.el.pause(),
        () => {},
      );
    }
    this.reconcile();
  }

  /** The track for the current screen. Unknown names → "normal". Same as now → nothing happens. */
  setMusic(name: string) {
    const next = this.config[name] ? name : this.fallback();
    if (next === this.target) return;
    if (DEV) console.info(`[music] ${this.target ?? "none"} → ${next ?? "none"}`);
    this.target = next;
    this.reconcile();
  }

  get current() {
    return this.target;
  }

  setMuted(m: boolean) {
    if (m === this.muted) return;
    this.muted = m;
    if (this.master && this.ctx) {
      const g = this.master.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(m ? 0 : 1, now);
    }
    if (m) {
      // everything silent + paused now; unmute fades the target in from 0
      for (const t of this.tracks.values()) {
        t.gen++;
        clearTimeout(t.pauseTimer);
        if (t.gain && this.ctx) {
          t.gain.gain.cancelScheduledValues(this.ctx.currentTime);
          t.gain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        t.el.pause();
      }
    } else this.reconcile();
  }

  /** After a blocked play() (autoplay policy) or a resumed tab: make sure the target is playing. */
  ensurePlaying() {
    const t = this.target ? this.tracks.get(this.target) : undefined;
    if (t && this.want(t) > 0 && t.el.paused) this.reconcile();
  }

  /** Silence and pause everything right away (the elements stay, for resuming later). */
  stopAll() {
    for (const t of this.tracks.values()) {
      t.gen++;
      clearTimeout(t.pauseTimer);
      if (t.gain && this.ctx) {
        t.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        t.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      t.el.pause();
    }
  }

  /** Stop + throw away every element and the Web Audio routing (dev reloads, new content). */
  release() {
    this.stopAll();
    for (const t of this.tracks.values()) {
      t.el.removeAttribute("src");
      t.el.load(); // aborts the download and frees the decoder
    }
    this.tracks.clear();
    this.master?.disconnect();
    this.master = null;
    this.ctx = null;
    this.unlocked = false;
  }

  /** dev: window.__music() */
  debug() {
    const out: Record<string, unknown> = {
      target: this.target,
      muted: this.muted,
      context: this.ctx?.state ?? (this.unlocked ? "no Web Audio" : "locked (no gesture yet)"),
    };
    for (const [name, t] of this.tracks)
      out[name] = {
        state: t.el.paused ? "paused" : "playing",
        gain: t.gain ? +t.gain.gain.value.toFixed(3) : null,
        time: +t.el.currentTime.toFixed(1),
        wanted: +this.want(t).toFixed(3),
      };
    return out;
  }

  /* ---------------- internals ---------------- */

  private fallback() {
    return this.config.normal ? "normal" : null;
  }

  private track(name: string): Track | undefined {
    const cfg = this.config[name];
    if (!cfg?.urls.length) return undefined;
    let t = this.tracks.get(name);
    if (!t) {
      const el = new Audio(cfg.urls[0]);
      el.loop = true;
      el.preload = "auto";
      t = { name, el, gain: null, level: clamp01(this.volume * (cfg.volume ?? 1)), gen: 0 };
      this.tracks.set(name, t);
    }
    if (this.ctx && this.master && !t.gain) {
      try {
        const g = this.ctx.createGain();
        g.gain.value = 0;
        this.ctx.createMediaElementSource(t.el).connect(g).connect(this.master);
        t.gain = g;
        t.el.volume = 1;
      } catch {
        /* routing failed: this track falls back to el.volume (no fades) */
      }
    }
    return t;
  }

  /** the gain this track should end up at */
  private want(t: Track) {
    return this.unlocked && !this.muted && t.name === this.target ? t.level : 0;
  }

  /** THE fade routine: every track toward its wanted level, overriding any fade in progress. */
  private reconcile(secs = MUSIC_FADE) {
    if (this.target) this.track(this.target);
    for (const t of this.tracks.values()) {
      const want = this.want(t);
      t.gen++;
      clearTimeout(t.pauseTimer);
      if (t.gain && this.ctx) {
        const p = t.gain.gain;
        const now = this.ctx.currentTime;
        // hold the current (mid-fade) value, then ramp from there
        if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(now);
        else {
          const v = p.value;
          p.cancelScheduledValues(now);
          p.setValueAtTime(v, now);
        }
        p.linearRampToValueAtTime(want, now + secs);
      } else if (this.unlocked) t.el.volume = want; // no Web Audio: jump (iOS ignores this anyway)

      if (want > 0) {
        if (t.el.paused) t.el.play().catch(() => {});
      } else if (!t.el.paused) {
        const gen = t.gen;
        t.pauseTimer = setTimeout(() => {
          if (gen === t.gen && this.want(t) === 0) t.el.pause();
        }, secs * 1000 + 50);
      }
    }
  }
}

export const music = new MusicController();

if (DEV) (window as unknown as { __music: () => unknown }).__music = () => music.debug();
// dev reloads must never leave a track playing
import.meta.hot?.dispose(() => music.release());
