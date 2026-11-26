/*
 * The weather: snow, sakura petals, leaves, rain, fireflies, stars, bubbles,
 * embers, or any characters you type in. Each kind is a small recipe:
 *   k       how many of them, relative to the "amount" setting
 *   make    fill in a fresh particle
 *   place   where it starts (default: anywhere at first, then just off-screen)
 *   step    its own movement (default: fall or rise, swaying)
 *   draw    how it looks
 *   under   drawn below the animals
 *   fixed   does not move, so clicks do not blow it about
 */
import { cfg } from "./settings.js";
import { world, rand, pick, clamp, TAU, MONO } from "./world.js";

const list = [];
let kind = "none", def = null, S = 1, A = 1, wind = 0, curFont = "";
let star = null, starT = 6;

const hexRgb = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
};
const font = px => `${Math.max(5, Math.round(px * S))}px ${MONO}`;

function glyph(ctx, p, t, a = p.a) {
  if (p.font !== curFont) { ctx.font = p.font; curFont = p.font; }
  ctx.fillStyle = `rgba(${p.c},${(a * A).toFixed(2)})`;
  ctx.fillText(p.ch, p.x, p.y);
}

/* a flat shape that tumbles as it falls: the path is drawn around 0,0 */
function tumbling(ctx, p, t, path) {
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  ctx.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(t * p.ff + p.ph)));
  ctx.globalAlpha = p.a * A; ctx.fillStyle = p.c;
  path(ctx, p.sz);
  ctx.restore();
}
const petalPath = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, 0);
  ctx.bezierCurveTo(-s * 0.3, -s * 0.5, s * 0.45, -s * 0.42, s * 0.55, -s * 0.08);
  ctx.lineTo(s * 0.38, 0); ctx.lineTo(s * 0.55, s * 0.08);
  ctx.bezierCurveTo(s * 0.45, s * 0.42, -s * 0.3, s * 0.5, -s * 0.55, 0);
  ctx.fill();
};
const leafPath = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, 0);
  ctx.quadraticCurveTo(0, -s * 0.55, s * 0.7, 0);
  ctx.quadraticCurveTo(0, s * 0.55, -s * 0.7, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-s * 0.9, 0); ctx.lineTo(s * 0.55, 0); ctx.stroke();
};

const anywhere = p => { p.y = rand(0, world.H); };

const TYPES = {
  snow: {
    k: 1,
    make(p) { p.vy = rand(22, 60); p.sway = 14; p.ch = Math.random() < 0.55 ? "*" : Math.random() < 0.5 ? "+" : "."; p.font = font(rand(10, 16)); p.a = rand(0.35, 0.9); p.c = "235,244,255"; },
    draw: glyph
  },
  sakura: {
    k: 0.55,
    make(p) { p.vy = rand(26, 58); p.sway = 32; p.sz = rand(8, 13) * S; p.a = rand(0.55, 0.95); p.c = `hsl(${rand(332, 350)},${rand(70, 92)}%,${rand(78, 90)}%)`; p.vr = rand(-1.2, 1.2); p.ff = rand(1.5, 3.5); },
    draw: (ctx, p, t) => tumbling(ctx, p, t, petalPath)
  },
  leaves: {
    k: 0.4,
    make(p) { p.vy = rand(32, 70); p.sway = 44; p.sz = rand(9, 15) * S; p.a = rand(0.6, 0.95); p.c = `hsl(${pick([8, 16, 26, 36, 46])},${rand(70, 90)}%,${rand(42, 58)}%)`; p.vr = rand(-1.6, 1.6); p.ff = rand(1, 2.6); },
    draw: (ctx, p, t) => tumbling(ctx, p, t, leafPath)
  },
  rain: {
    k: 1,
    make(p) { p.vy = rand(700, 1050); p.len = rand(12, 24) * S; p.a = rand(0.18, 0.45); p.splash = -1; },
    place(p, fresh) { p.gy = rand(0, world.H); p.y = fresh ? rand(-world.H, p.gy) : rand(-220, -10); },
    step(p, dt, sp) {
      if (p.splash >= 0) { p.splash += dt; if (p.splash > 0.3) spawn(p, false); return; }
      p.y += p.vy * sp * dt; p.x += (wind * 2 + p.px) * dt;
      if (p.y >= p.gy) p.splash = 0;                           // hits the ground
    },
    draw(ctx, p) {
      ctx.lineWidth = 1;
      if (p.splash >= 0) {
        const k = p.splash / 0.3, r = 2 + k * 14 * S;
        ctx.strokeStyle = `rgba(190,225,255,${((1 - k) * 0.5 * A).toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.gy, r, r * 0.45, 0, 0, TAU); ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(190,225,255,${(p.a * A).toFixed(2)})`;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * wind * 2 / p.vy, p.y - p.len); ctx.stroke();
      }
    }
  },
  fireflies: {
    k: 0.3,
    make(p) { p.dir = rand(0, TAU); p.spd = rand(10, 30); p.f = rand(0.6, 1.7); p.sz = rand(1.4, 2.8) * S; p.c = pick(["255,236,140", "214,255,150", "255,214,120"]); },
    place: anywhere,
    step(p, dt, sp) {
      const { W, H } = world;
      p.dir += rand(-2.5, 2.5) * dt;
      p.x += (Math.cos(p.dir) * p.spd * sp + wind * 0.15 + p.px) * dt;
      p.y += (Math.sin(p.dir) * p.spd * sp + p.py) * dt;
      if (p.y < -24) p.y = H + 24; else if (p.y > H + 24) p.y = -24;
    },
    draw(ctx, p, t) {
      const b = Math.max(0, Math.sin(t * p.f + p.ph)), a = (0.12 + 0.88 * b * b) * A;
      ctx.fillStyle = `rgba(${p.c},${(a * 0.16).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * 4, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${p.c},${a.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * 0.7, 0, TAU); ctx.fill();
    }
  },
  stars: {
    k: 1.2, under: true, fixed: true,
    make(p) { p.ch = pick([".", ".", "+", "*", "·"]); p.font = font(rand(9, 15)); p.f = rand(0.4, 1.6); p.c = pick(["235,244,255", "255,244,214", "214,230,255"]); },
    place: anywhere,
    step() {},
    draw: (ctx, p, t) => glyph(ctx, p, t, 0.2 + 0.8 * Math.abs(Math.sin(t * p.f + p.ph)))
  },
  bubbles: {
    k: 0.4,
    make(p) { p.vy = -rand(24, 70); p.sway = 18; p.sz = rand(2.5, 9) * S; p.a = rand(0.3, 0.7); },
    draw(ctx, p) {
      ctx.lineWidth = 1; ctx.strokeStyle = `rgba(190,232,255,${(p.a * A).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * 0.6, -2.4, -1.5); ctx.stroke();
    }
  },
  embers: {
    k: 0.5,
    make(p) { p.vy = -rand(30, 95); p.sway = 24; p.ch = pick(["*", ".", "'", "+"]); p.font = font(rand(9, 15)); p.f = rand(6, 12); p.c = pick(["255,170,70", "255,120,50", "255,214,130"]); p.a = rand(0.5, 1); },
    draw: (ctx, p, t) => glyph(ctx, p, t, p.a * (0.45 + 0.55 * Math.abs(Math.sin(t * p.f + p.ph))))
  },
  custom: {
    k: 0.7,
    make(p) {
      const set = Array.from(cfg.particles.custom || "").filter(ch => ch.trim());
      p.ch = set.length ? pick(set) : "*";
      p.vy = rand(22, 60) * (cfg.particles.rise ? -1 : 1); p.sway = 16;
      p.font = font(rand(12, 20)); p.a = rand(0.45, 0.95); p.c = hexRgb(cfg.particles.color);
    },
    draw: glyph
  }
};
export const PARTICLE_TYPES = ["auto", "none", ...Object.keys(TYPES)];

function spawn(p, fresh) {
  const { W, H } = world;
  p.ph = rand(0, TAU); p.px = 0; p.py = 0; p.rot = rand(0, TAU); p.vr = 0; p.sway = 0; p.vy = 0;
  def.make(p);
  p.x = rand(0, W);
  if (def.place) def.place(p, fresh);
  else p.y = fresh ? rand(0, H) : p.vy < 0 ? H + rand(4, 30) : rand(-30, -4);
  return p;
}

const want = () => def ? Math.round(cfg.particles.amount * def.k * clamp(world.W * world.H / 2e6, 0.4, 2.5)) : 0;

/* call when the kind of particle may have changed (or the screen was resized) */
export function rebuild(species) {
  const type = cfg.particles.type === "auto" ? (species && species.particles) || "snow" : cfg.particles.type;
  S = cfg.particles.size;
  if (type !== kind) { kind = type; def = TYPES[type] || null; list.length = 0; star = null; }
  const n = want();
  while (list.length < n) list.push(spawn({}, true));
  list.length = Math.min(list.length, n);
}

/* same kind, new look (size, colour, symbols): re-make each one where it is */
export function restyle() {
  if (!def) return;
  S = cfg.particles.size;
  for (const p of list) { const x = p.x, y = p.y; spawn(p, true); p.x = x; if (!def.place) p.y = y; }
}

export function update(dt, t) {
  if (!def) return;
  const { W, H } = world, sp = cfg.particles.speed, drag = Math.pow(0.35, dt);
  wind = cfg.particles.wind * 170;
  for (const p of list) {
    if (def.step) def.step(p, dt, sp);
    else {
      p.y += (p.vy * sp + p.py) * dt;
      p.x += (p.px + wind + Math.sin(t * 0.8 + p.ph) * p.sway) * dt;
      if (p.vy >= 0 ? p.y > H + 24 : p.y < -24) spawn(p, false);
    }
    p.px *= drag; p.py *= drag; p.rot += p.vr * dt;
    if (p.x < -24) p.x = W + 24; else if (p.x > W + 24) p.x = -24;
  }
  if (kind === "stars") {                                      // now and then a shooting star
    starT -= dt;
    if (starT <= 0 && !star) { star = { x: rand(0.1, 0.9) * W, y: rand(0, 0.5) * H, a: rand(0.3, 1), t: 0 }; starT = rand(5, 12) / Math.max(0.2, sp); }
    if (star) { star.t += dt; if (star.t > 0.8) star = null; }
  }
}

function drawAll(t) {
  const ctx = world.ctx;
  A = cfg.particles.opacity; curFont = "";
  for (const p of list) def.draw(ctx, p, t);
  if (star) {
    const d = star.t * 900, x = star.x + Math.cos(star.a) * d, y = star.y + Math.sin(star.a) * d, k = 1 - star.t / 0.8;
    const g = ctx.createLinearGradient(x, y, x - Math.cos(star.a) * 140, y - Math.sin(star.a) * 140);
    g.addColorStop(0, `rgba(255,255,255,${(k * A).toFixed(2)})`); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(star.a) * 140, y - Math.sin(star.a) * 140); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
export function drawUnder(t) { if (def && def.under) drawAll(t); }
export function drawOver(t) { if (def && !def.under) drawAll(t); }

/* a click pushes whatever is nearby aside */
export function blow(x, y) {
  if (!def || def.fixed || !cfg.particles.react) return;
  for (const p of list) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) + 1;
    if (d < 420) { const k = (1 - d / 420) * 340; p.px += dx / d * k; p.py += dy / d * k * 0.4; }
  }
}
