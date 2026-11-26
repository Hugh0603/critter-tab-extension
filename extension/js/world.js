/* Shared state and small drawing helpers used by every animal. */
import { cfg } from "./settings.js";

export const TAU = Math.PI * 2;
export const CELL = 11;
export const MONO = "ui-monospace, Menlo, Consolas, monospace";
export const HAT_COLORS = ["hsl(355,78%,48%)", "hsl(355,78%,48%)", "hsl(46,92%,55%)", "hsl(205,80%,55%)"];
export const SCARF_COLORS = ["hsl(355,75%,50%)", "hsl(140,55%,42%)", "hsl(46,90%,55%)", "hsl(190,70%,48%)"];
export const CONFETTI_COLORS = ["#ff5d6c", "#ffd25e", "#ffffff", "#7ee0a1", "#6fb6ff"];

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/* shortest signed turn from angle b to angle a */
export const angDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
};

export const world = {
  W: 0, H: 0, dpr: 1, ctx: null,
  species: "penguin",
  glyphs: Array.from("@%#*:=+;"), glyphsOn: true,
  sparks: [], ripples: [],
  shake: 0,                                  // how hard the screen is shaking right now
  mouse: { x: 0, y: 0, on: false }           // where the cursor is, and whether it is over the page
};

/* things that lure animals (food, yarn, flowers) are noticed from at least this far, however small the click reach */
export const lureReach = () => Math.max(cfg.reach, 240);

/* a soft round light of the given hue, drawn once and reused */
const glows = new Map();
export function glow(h) {
  let c = glows.get(h);
  if (!c) {
    c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `hsla(${h},95%,72%,.6)`); gr.addColorStop(0.4, `hsla(${h},95%,62%,.2)`); gr.addColorStop(1, `hsla(${h},95%,60%,0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glows.set(h, c);
  }
  return c;
}

/* the size of one cell, in px */
export const cell = () => CELL * cfg.size;

export function syncGlyphs() {
  const g = Array.from(cfg.glyphSet || "").filter(ch => ch.trim());
  world.glyphs = g.length ? g : Array.from("@%#*:=+;");
  world.glyphsOn = cfg.glyphs;
}

export const shimmer = (c, t) => world.glyphs[(Math.floor(t * 1.6 + c.ph) + (c.ph * 7 | 0)) % world.glyphs.length];

/* one sprite cell: a square, plus a flickering ASCII glyph when it has a glyph colour */
export function paintCell(c, px, py, size, t, w = size) {
  const ctx = world.ctx;
  ctx.fillStyle = c.fill;
  ctx.fillRect(px - w / 2, py - size / 2, Math.max(1, w - 1), size - 1);
  if (c.gc && world.glyphsOn && w > size * 0.6) { ctx.fillStyle = c.gc; ctx.fillText(shimmer(c, t), px, py); }
}

export function pupil(px, py, r) {
  const ctx = world.ctx;
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
}

/*
 * Turn rows of characters into cells. paint(ch, col, row) returns [fill, glyphColour]
 * (or null to skip the cell). cx, cy is the point of the sprite that sits on the animal's x, y.
 */
export function makeCells(rows, cx, cy, paint) {
  const out = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      const p = paint(ch, c, r);
      if (!p) continue;
      out.push({ ox: c - cx, oy: r - cy, ch, fill: p[0], gc: p[1] || null, ph: Math.random() * 6 });
    }
  });
  return out;
}

/* turn a cell offset by k quarter turns */
export const turn = (ox, oy, k) => {
  const th = k * Math.PI / 2, co = Math.round(Math.cos(th)), si = Math.round(Math.sin(th));
  return [ox * co - oy * si, ox * si + oy * co];
};

/* a little ASCII particle; g is its gravity (px/s²) */
export function spark(o) {
  if (world.sparks.length > 700) world.sparks.shift();
  world.sparks.push(Object.assign({ vx: 0, vy: 0, life: 0.6, age: 0, ch: "*", c: "#e6f1ff", g: 520 }, o));
}

export function puff(x, y, n, spread, color) {
  for (let i = 0; i < n; i++) {
    spark({ x: x + rand(-spread, spread), y: y + rand(-spread * 0.5, spread * 0.5), vx: rand(-110, 110), vy: rand(-160, -30),
      life: rand(0.3, 0.7), ch: Math.random() < 0.5 ? "*" : ".", c: color || "#e6f1ff" });
  }
}

/* keep a point inside the screen with a margin; returns true if it had to be moved */
export function keepIn(o, m) {
  const { W, H } = world;
  let hit = false;
  if (o.x < m) { o.x = m; hit = true; } else if (o.x > W - m) { o.x = W - m; hit = true; }
  if (o.y < m) { o.y = m; hit = true; } else if (o.y > H - m) { o.y = H - m; hit = true; }
  return hit;
}
