/*
 * Jellyfish pulse their bells to rise, then sink slowly, trailing tentacles.
 * Click: a pulse runs out; the ones it reaches flash and jet away.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, makeCells, paintCell, spark } from "../world.js";

/* B bell, s light spot, b rim */
const BELL = [
  "..BBBBB..",
  ".BBBBBBB.",
  "BBsBBBsBB",
  "BBBBBBBBB",
  "b.b.b.b.b"
];
const JS = 0.8;
const HUES = [305, 268, 190, 215, 165, 335];

const glows = new Map();
function glowSprite(h) {
  let c = glows.get(h);
  if (!c) {
    c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `hsla(${h},95%,72%,.6)`);
    gr.addColorStop(0.4, `hsla(${h},95%,62%,.2)`);
    gr.addColorStop(1, `hsla(${h},95%,60%,0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glows.set(h, c);
  }
  return c;
}

class Jelly {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.tilt = rand(-0.4, 0.4); this.tiltGoal = this.tilt;
    this.pp = rand(0, 1); this.period = rand(1.7, 2.6);
    this.rise = Math.random() < 0.5; this.top = rand(0.12, 0.4); this.bottom = rand(0.6, 0.9);
    this.flash = 0; this.react = null;
    this.h = pick(HUES);
    this.cs = cell() * JS * rand(0.7, 1.25); this.rad = this.cs * 4.6; this.ay = 1;
    const h = this.h;
    this.cells = makeCells(BELL, 4, 2, ch => {
      const n = Math.random();
      if (ch === "s") return [`hsla(${h},80%,${82 + n * 8}%,.92)`, null];
      if (ch === "b") return [`hsla(${h},65%,${50 + n * 8}%,.8)`, null];
      return [`hsla(${h},70%,${58 + n * 10}%,.85)`, "rgba(255,255,255,.34)"];
    });
    this.tent = [-3, -1, 1, 3].map(ox => ({
      ox, ph: rand(0, 6),
      n: Math.max(2, Math.round(rand(4, 8) * cfg.jelly.tentacles)),
      fill: `hsla(${h},65%,${rand(68, 80)}%,.55)`
    }));
  }

  get soft() { return true; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  update(dt) {
    const { W, H } = world;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const r = this.react, v = 140 + 280 * r.k; this.react = null;
        this.flash = 1; this.pp = 0;
        this.vx += Math.cos(r.ang) * v; this.vy += Math.sin(r.ang) * v;
        for (let i = 0; i < 6; i++) spark({ x: this.x + rand(-20, 20), y: this.y + rand(-14, 14), vx: rand(-70, 70), vy: rand(-70, 70), life: rand(0.5, 1), ch: pick(["·", "*", "+"]), c: `hsl(${this.h},95%,80%)`, g: 30 });
      }
    }
    this.pp += dt / this.period * cfg.jelly.pulse * Math.max(0.4, Math.sqrt(cfg.speed));
    if (this.pp >= 1) {                                        // the bell snaps shut: a push along its tilt
      this.pp -= 1;
      if (this.y < H * this.top) this.rise = false; else if (this.y > H * this.bottom) this.rise = true;
      const j = (this.rise ? 105 : 26) * Math.max(0.4, cfg.speed);
      this.vx += Math.sin(this.tilt) * j; this.vy -= Math.cos(this.tilt) * j;
      this.tiltGoal = rand(-0.6, 0.6);
      if (this.x < 170) this.tiltGoal = rand(0.3, 0.8); else if (this.x > W - 170) this.tiltGoal = rand(-0.8, -0.3);
    }
    this.vy += 24 * dt;                                        // sinks
    const f = Math.pow(0.3, dt); this.vx *= f; this.vy *= f;
    this.x = clamp(this.x + this.vx * dt, 40, W - 40);
    this.y = clamp(this.y + this.vy * dt, 50, H - 60);
    this.tilt += (this.tiltGoal - this.tilt) * Math.min(1, dt * 1.4);
    if (this.flash > 0) this.flash -= dt / 1.3;
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, p = this.pp;
    const c = p < 0.2 ? p / 0.2 : Math.pow(1 - (p - 0.2) / 0.8, 2);     // how far the bell is squeezed
    const ws = 1 - 0.2 * c, hs = 1 + 0.12 * c, flash = Math.max(0, this.flash);
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.tilt * 0.6);
    const glow = cfg.jelly.glow * (0.4 + 0.25 * c + 1.2 * flash);
    if (glow > 0.02) {
      const R = cs * (7.5 + 3 * flash);
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, glow);
      ctx.drawImage(glowSprite(this.h), -R, -R - cs * 0.5, R * 2, R * 2);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
    /* tentacles trail behind: stretched when it jets up, bunched when it sinks */
    const seg = cs * 0.8 * (1 + clamp(-this.vy / 240, -0.25, 0.5)), ts = cs * 0.55, y0 = cs * 2.6 * hs;
    for (const tn of this.tent) {
      ctx.fillStyle = tn.fill;
      for (let i = 0; i < tn.n; i++) {
        const k = (i + 1) / tn.n;
        const tx = tn.ox * cs * ws + Math.sin(t * 2.4 + i * 0.7 + tn.ph) * cs * 0.5 * k - this.vx * 0.03 * i;
        ctx.fillRect(tx - ts / 2, y0 + i * seg, ts - 1, ts - 1);
      }
    }
    for (const cl of this.cells) paintCell(cl, cl.ox * cs * ws, cl.oy * cs * hs, cs, t, cs * ws + 0.5);
    if (flash > 0.05) {
      ctx.globalAlpha = flash * 0.45; ctx.fillStyle = "#fff";
      ctx.fillRect(-cs * 4.5 * ws, -cs * 2.5 * hs, cs * 9 * ws, cs * 4 * hs);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

export default {
  id: "jelly", dot: "#c58bff", theme: "abyss", particles: "bubbles",
  density: 1 / 120000, margin: 90, glyphScale: JS,

  init() {},
  make: (x, y) => new Jelly(x, y)
};
