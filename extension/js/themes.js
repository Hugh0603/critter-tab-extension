/* Background themes: bg is the edge colour, bg2 the soft light in the centre. */
import { cfg } from "./settings.js";

export const THEMES = {
  night:  { bg: "#070912", bg2: "#10162e" },
  ice:    { bg: "#081220", bg2: "#12283f" },
  swamp:  { bg: "#06110a", bg2: "#10281a" },
  pond:   { bg: "#04141a", bg2: "#0b2f38" },
  dusk:   { bg: "#120b1a", bg2: "#2a1738" },
  abyss:  { bg: "#02030c", bg2: "#0a1238" },
  hearth: { bg: "#120c09", bg2: "#2a1a12" },
  forest: { bg: "#080d07", bg2: "#1a2a15" },
  sand:   { bg: "#15100a", bg2: "#3a2d1b" },
  reef:   { bg: "#03121c", bg2: "#0a3448" },
  mono:   { bg: "#000000", bg2: "#0c0c0c" }
};

const lighten = (hex, k) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#10162e";
  const n = parseInt(m[1], 16);
  const ch = v => Math.round(v + (255 - v) * k).toString(16).padStart(2, "0");
  return "#" + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
};

export function themeColors(species) {
  if (cfg.theme === "custom") return { bg: cfg.bg, bg2: lighten(cfg.bg, 0.09) };
  return THEMES[cfg.theme] || THEMES[species && species.theme] || THEMES.night;
}
