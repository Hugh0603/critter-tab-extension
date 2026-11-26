/*
 * Octopuses creep around with their arms curling, slowly changing colour.
 * Click: the ones the wave reaches turn pale, squirt a cloud of ink and
 * jet away head first, arms trailing.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, angDiff, makeCells, shimmer, pupil } from "../world.js";

const HEAD = [
  "..HHHHH..",
  ".HHHHHHH.",
  ".HEHHHEH.",
  ".HHHHHHH.",
  "..HHHHH.."
];
const OS = 0.8;
const ARMS = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];

const ink = [];

function squirt(x, y, ang) {
  const size = cfg.octopus.ink;
  if (size <= 0) return;
  for (let i = 0; i < 10; i++) {
    const a = ang + Math.PI + rand(-1.1, 1.1), v = rand(20, 110);
    if (ink.length > 120) ink.shift();
    ink.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(8, 16) * size, grow: rand(22, 46) * size, age: 0, life: cfg.octopus.inkLife * rand(0.7, 1.2) });
  }
}

class Octopus {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.rot = 0; this.hue = pick([350, 18, 285, 195, 140, 45]);
    this.scare = 0; this.jet = 0; this.react = null;
    this.tx = x; this.ty = y; this.goT = rand(0, 3); this.ph = rand(0, 6);
    this.cs = cell() * OS * rand(0.8, 1.2); this.rad = this.cs * 5; this.ay = 1;
    this.cells = makeCells(HEAD, 4, 2, ch => [ch, ch === "E" ? null : "rgba(255,255,255,.3)"]);
    for (const c of this.cells) c.sh = Math.floor(Math.random() * 3);
    this.arms = ARMS.map(ox => ({ ox, ph: rand(0, 6), n: Math.round(rand(5, 7)), sh: Math.floor(Math.random() * 3) }));
  }

  get soft() { return this.jet <= 0; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  update(dt) {
    const { W, H } = world, m = 70;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const r = this.react, v = 300 + 380 * r.k; this.react = null;
        const a = r.ang + rand(-0.4, 0.4);
        squirt(this.x, this.y, a);
        this.vx = Math.cos(a) * v; this.vy = Math.sin(a) * v;
        this.scare = 1; this.jet = 0.9 + r.k * 0.6;
      }
    }
    this.hue = (this.hue + dt * 7 * cfg.octopus.shift) % 360;
    if (this.scare > 0) this.scare -= dt / 2.2;
    if (this.jet > 0) {
      this.jet -= dt;
      const f = Math.pow(0.18, dt); this.vx *= f; this.vy *= f;
      if (this.jet <= 0) { this.tx = this.x; this.ty = this.y; this.goT = rand(1, 3); }
    } else {                                                   // creeps towards a spot, then picks another
      this.goT -= dt;
      if (this.goT <= 0) { this.tx = rand(m, W - m); this.ty = rand(m, H - m); this.goT = rand(3, 8); }
      const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
      const sp = Math.min(30 * cfg.speed, d);
      const k = Math.min(1, dt * 2);
      this.vx += ((d > 1 ? dx / d * sp : 0) - this.vx) * k;
      this.vy += ((d > 1 ? dy / d * sp : 0) - this.vy) * k;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); } else if (this.x > W - m) { this.x = W - m; this.vx = -Math.abs(this.vx); }
    if (this.y < m) { this.y = m; this.vy = Math.abs(this.vy); } else if (this.y > H - m) { this.y = H - m; this.vy = -Math.abs(this.vy); }
    /* when it moves fast it turns head first */
    const sp = Math.hypot(this.vx, this.vy);
    const want = sp > 70 ? Math.atan2(this.vy, this.vx) + Math.PI / 2 : 0;
    this.rot += angDiff(want, this.rot) * Math.min(1, dt * (sp > 70 ? 9 : 2.5));
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs;
    const sp = Math.hypot(this.vx, this.vy), jet = clamp((sp - 40) / 220, 0, 1), spread = 1 - 0.8 * jet;
    const pale = Math.max(0, this.scare) * 26;
    const shades = [46, 53, 60].map(l => `hsl(${this.hue.toFixed(0)},${65 - pale}%,${l + pale}%)`);
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.rot + Math.sin(t * 0.7 + this.ph) * 0.12 * spread);
    for (const arm of this.arms) {                              // arms first, the head sits on top
      ctx.fillStyle = shades[arm.sh];
      for (let i = 0; i < arm.n; i++) {
        const k = (i + 1) / arm.n, s = cs * (0.92 - 0.5 * k);
        const ax = arm.ox * cs * 0.75 * (1 + i * 0.26 * spread) + Math.sin(t * 2.1 + i * 0.9 + arm.ph) * cs * 0.55 * k * (0.3 + 0.7 * spread);
        const ay = cs * 2.3 + i * cs * 0.74 * (1 + 0.55 * jet) - Math.abs(arm.ox) * cs * 0.12 * i * spread;
        ctx.fillRect(ax - s / 2, ay - s / 2, s - 1, s - 1);
      }
    }
    for (const c of this.cells) {
      const px = c.ox * cs, py = c.oy * cs;
      if (c.ch === "E") {
        ctx.fillStyle = "#f6f6f2"; ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
        pupil(px, py, cs * (this.scare > 0.3 ? 0.36 : 0.22));
        continue;
      }
      ctx.fillStyle = shades[c.sh]; ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
      if (world.glyphsOn) { ctx.fillStyle = c.gc; ctx.fillText(shimmer(c, t), px, py); }
    }
    ctx.restore();
  }
}

export default {
  id: "octopus", dot: "#ff7b6b", theme: "reef", particles: "bubbles",
  density: 1 / 140000, margin: 90, glyphScale: OS,

  init() { ink.length = 0; },
  make: (x, y) => new Octopus(x, y),

  update(dt) {
    for (let i = ink.length - 1; i >= 0; i--) {
      const b = ink[i];
      b.age += dt;
      if (b.age >= b.life) { ink.splice(i, 1); continue; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      const f = Math.pow(0.2, dt); b.vx *= f; b.vy *= f;
    }
  },

  /* the ink hangs in the water above everything */
  over() {
    const ctx = world.ctx;
    for (const b of ink) {
      const p = b.age / b.life, r = b.r + b.grow * (1 - Math.pow(1 - Math.min(1, b.age / 1.2), 2));
      ctx.fillStyle = `rgba(10,8,24,${(0.5 * (1 - p * p)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
    }
  }
};
