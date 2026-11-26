/*
 * Settings: one plain object (cfg) that everything reads live.
 * Only the values that differ from DEFAULTS are stored, in localStorage,
 * so the page paints with the right settings on the very first frame and
 * the extension needs no storage permission.
 */
export const VERSION = "2.3.0";
const KEY = "pondtab.settings";

export const DEFAULTS = {
  lang: "auto",                 // auto | en | ru

  /* animals */
  animal: "penguin",            // a species id, or "random"
  switcher: true,               // the animal switcher at the top of the page
  gear: true,                   // the settings button in the corner
  count: 1.3,
  size: 1.2,
  speed: 1,
  hats: true,
  reach: 750,                   // px, how far a click reaches
  wave: 1400,                   // px/s, how fast the click wave travels
  confetti: true,
  ripple: true,

  penguin: { tumble: 0.6, flyers: 0.3, dancers: 0.25, slideEvery: 5, maxSliders: 2, snowballs: true, ballEvery: 7, ballRange: 520, aimError: 45 },
  frog: { kick: 0.4, trail: true },
  fish: { click: "feed", food: 5, appetite: 1, palette: "koi", rings: true },
  cat: { lazy: 0.4, playful: 1, yarnLife: 10, pet: true },
  butterfly: { flutter: 1, flowerLife: 25, maxFlowers: 10 },
  jelly: { glow: 0.7, pulse: 1, tentacles: 1 },
  hedgehog: { roll: 1, curl: 2, apples: true },
  octopus: { ink: 1, inkLife: 4, shift: 1 },
  ghost: { follow: true, opacity: 0.85, hide: 1 },
  crab: { hide: 2.5, claws: 0.5 },
  slime: { merge: 6, bounce: 1 },
  dino: { rex: 1, shake: 1, flee: 1 },
  squid: { dark: 0.7, relight: 4, glow: 0.8 },
  mouse: { cheese: 8, holes: 6, shy: 1 },
  bee: { hives: 2, flowerLife: 25, anger: 6 },
  spider: { wait: 3, sway: 1, webs: true },
  chameleon: { tongue: 380, camo: 8 },
  dog: { throw: 380, scratch: 0.5, wag: 1 },
  bat: { fly: 6, flap: 1, insomnia: 0.4 },
  snail: { trail: 14, hide: 4, pace: 1 },
  owl: { turn: 0.5, blink: 1, hoot: true },
  duck: { chicks: 4, scatter: 3, quack: true, wake: true },
  snake: { grow: 3, max: 60, pace: 1 },
  ufo: { saucers: 2, lift: 1 },

  particles: { type: "auto", amount: 130, speed: 1, size: 1, wind: 0, opacity: 1, react: true, custom: "♥✦", color: "#ffffff", rise: false },

  title: { mode: "newyear", text: "Hello", name: "", event: "", date: "", h24: true, seconds: false, sub: "none", size: 1, font: "sans", color: "#ffffff", glow: true },

  search: { show: true, engine: "default", custom: "https://www.google.com/search?q=%s", newTab: false, width: 720 },

  /* look */
  theme: "auto",
  bg: "#070912",
  grid: true,
  gridAlpha: 0.045,
  vignette: true,
  glyphs: true,
  glyphSet: "@%#*:=+;",
  shadows: true,

  /* system */
  fps: 60,                      // 15 | 30 | 60 | 0 (as fast as the monitor goes)
  showFps: false,
  quality: "high"               // low | medium | high | ultra
};

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const clone = o => JSON.parse(JSON.stringify(o));

export const cfg = clone(DEFAULTS);

function merge(dst, src, def) {
  if (!isObj(src)) return;
  for (const k of Object.keys(def)) {
    if (!(k in src)) continue;
    if (isObj(def[k])) merge(dst[k], src[k], def[k]);
    else if (typeof src[k] === typeof def[k]) dst[k] = src[k];
  }
}

function diff(cur, def) {
  const out = {};
  for (const k of Object.keys(def)) {
    if (isObj(def[k])) {
      const d = diff(cur[k], def[k]);
      if (Object.keys(d).length) out[k] = d;
    } else if (cur[k] !== def[k]) out[k] = cur[k];
  }
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) merge(cfg, JSON.parse(raw), DEFAULTS);
    else {
      const old = localStorage.getItem("pond-mode");      // the 1.x key
      if (old === "frog" || old === "penguin") cfg.animal = old;
    }
  } catch (e) { /* storage is blocked: run on defaults */ }
}

let timer = 0;
export function flush() {
  clearTimeout(timer); timer = 0;
  try { localStorage.setItem(KEY, JSON.stringify(diff(cfg, DEFAULTS))); } catch (e) { /* private window */ }
}
function save() { if (!timer) timer = setTimeout(flush, 200); }
window.addEventListener("pagehide", () => { if (timer) flush(); });

const walk = (root, path) => {
  const parts = path.split(".");
  let o = root;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  return [o, parts[parts.length - 1]];
};
export const get = path => { const [o, k] = walk(cfg, path); return o[k]; };
export const def = path => { const [o, k] = walk(DEFAULTS, path); return o[k]; };

const listeners = [];
export const on = fn => { listeners.push(fn); };
const emit = key => { for (const fn of listeners) fn(key); };

export function set(path, value) {
  const [o, k] = walk(cfg, path);
  if (o[k] === value) return;
  o[k] = value;
  save(); emit(path);
}

export function reset() {
  const fresh = clone(DEFAULTS);
  for (const k of Object.keys(fresh)) cfg[k] = fresh[k];
  flush(); emit("*");
}

export const exportJSON = () => JSON.stringify({ app: "critter-tab", version: VERSION, settings: diff(cfg, DEFAULTS) }, null, 2);

export function importJSON(text) {
  const data = JSON.parse(text);
  const src = isObj(data) && isObj(data.settings) ? data.settings : data;
  if (!isObj(src)) throw new Error("not a settings file");
  const fresh = clone(DEFAULTS);
  merge(fresh, src, DEFAULTS);
  for (const k of Object.keys(fresh)) cfg[k] = fresh[k];
  flush(); emit("*");
}

/*
 * The toolbar popup is an extension page on the same origin, so it writes straight to
 * localStorage. This picks its changes up while the tab is open, without a reload.
 */
const LIVE = ["switcher", "gear"];
window.addEventListener("storage", e => {
  if (e.key !== KEY) return;
  let src;
  try { src = e.newValue ? JSON.parse(e.newValue) : {}; } catch (err) { return; }
  for (const k of LIVE) {
    const v = typeof src[k] === "boolean" ? src[k] : DEFAULTS[k];
    if (cfg[k] !== v) { cfg[k] = v; emit(k); }
  }
});
