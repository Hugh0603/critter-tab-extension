/*
 * Glowing squid drift through dark water in little bursts, each with its own light.
 * Click: the ones the wave reaches put their lights out and dart off; the more
 * lights are out, the darker the whole screen gets. Then they light up again, one by one.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, angDiff, makeCells, paintCell, pupil, spark, glow } from "../world.js";

/* seen from above, swimming to the right. M mantle, g glowing spot, f fin, E eye, t tentacle */
const ROWS = [
  "......f....",
  "t.t..MgMMf.",
  "ttttEMMgMMM",
  "t.t..MgMMf.",
  "......f...."
];
const QS = 0.75;

let list = [], dark = 0;

class Squid {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.a = rand(0, TAU); this.goal = this.a; this.sp = rand(10, 60);
    this.pT = rand(0, 2); this.turnT = rand(0.5, 3); this.out = false;
    this.lit = 1; this.off = 0; this.react = null; this.ph = rand(0, 6);
    this.h = pick([190, 205, 265, 320, 165, 48]);
    this.cs = cell() * QS * rand(0.8, 1.25); this.rad = this.cs * 3.4; this.ay = 1;
    const h = this.h;
    this.cells = makeCells(ROWS, 5, 2, ch => {
      const n = Math.random();
      if (ch === "E") return ["#f6f6f2", null];
      if (ch === "g") return [`hsl(${h},100%,${70 + n * 10}%)`, null];
      if (ch === "t" || ch === "f") return [`hsla(${h},45%,${40 + n * 8}%,.85)`, null];
      return [`hsl(${h},50%,${26 + n * 8}%)`, "rgba(255,255,255,.26)"];
    });
  }

  get soft() { return true; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  update(dt) {
    const { W, H } = world, m = 60;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const r = this.react; this.react = null;
        this.off = cfg.squid.relight * rand(0.4, 1.6);        // lights out
        this.a = this.goal = r.ang + rand(-0.4, 0.4); this.sp = 260 + 200 * r.k; this.pT = 0.8;
      }
    }
    if (this.off > 0) {
      this.off -= dt;
      if (this.off <= 0) for (let i = 0; i < 5; i++) spark({ x: this.x, y: this.y, vx: rand(-60, 60), vy: rand(-60, 60), life: rand(0.4, 0.8), ch: pick(["·", "*", "+"]), c: `hsl(${this.h},100%,78%)`, g: 0 });
    }
    this.lit += ((this.off > 0 ? 0 : 1) - this.lit) * Math.min(1, dt * (this.off > 0 ? 12 : 2.5));
    /* swims in pulses: a push, then a glide */
    this.pT -= dt;
    if (this.pT <= 0) { this.sp += rand(70, 120) * cfg.speed; this.pT = rand(1.1, 2.4); }
    this.sp = Math.max(8, this.sp * Math.pow(0.32, dt));
    this.turnT -= dt;
    if (this.turnT <= 0) { this.goal = this.a + rand(-1.2, 1.2); this.turnT = rand(1.5, 5); }
    const out = this.x < m || this.x > W - m || this.y < m || this.y > H - m;
    if (out && !this.out) { this.goal = Math.atan2(H / 2 - this.y + rand(-150, 150), W / 2 - this.x + rand(-200, 200)); this.turnT = rand(2, 4); }
    this.out = out;
    this.a += clamp(angDiff(this.goal, this.a) * 3 * dt, -2.2 * dt, 2.2 * dt);
    this.x = clamp(this.x + Math.cos(this.a) * this.sp * dt, -20, W + 20);
    this.y = clamp(this.y + Math.sin(this.a) * this.sp * dt, -20, H + 20);
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, lit = this.lit;
    const shine = cfg.squid.glow * lit * (0.75 + 0.25 * Math.sin(t * 2.2 + this.ph));
    const squeeze = clamp(this.sp / 200, 0, 1);                // tentacles pull together when it shoots forward
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.a);
    if (shine > 0.02) {
      const R = cs * 9;
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, shine);
      ctx.drawImage(glow(this.h), -R, -R, R * 2, R * 2);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
    for (const c of this.cells) {
      const px = c.ox * cs;
      let py = c.oy * cs;
      if (c.ch === "t") py = py * (1 - 0.5 * squeeze) + Math.sin(t * 5 + c.ox * 0.9 + this.ph) * cs * 0.4 * (1 - squeeze);
      if (c.ch === "g") {                                      // the spots are dull when its light is out
        ctx.fillStyle = `hsl(${this.h},40%,34%)`; ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
        ctx.globalAlpha = lit; ctx.fillStyle = c.fill; ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1); ctx.globalAlpha = 1;
      } else paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px, py, cs * 0.26);
    }
    ctx.restore();
  }
}

export default {
  id: "squid", dot: "#6fe3ff", theme: "abyss", particles: "fireflies",
  density: 1 / 105000, margin: 80, glyphScale: QS,

  init(animals) { list = animals; dark = 0; },
  make: (x, y) => new Squid(x, y),

  update(dt) {
    const out = list.filter(a => a.off > 0).length;
    const want = list.length ? cfg.squid.dark * out / list.length : 0;
    dark += (want - dark) * Math.min(1, dt * 3);
  },

  /* the darkness, and on top of it the squid whose lights are still on */
  over(t) {
    if (dark < 0.01) return;
    const ctx = world.ctx;
    ctx.fillStyle = `rgba(0,0,6,${Math.min(0.97, dark).toFixed(3)})`;
    ctx.fillRect(0, 0, world.W, world.H);
    for (const a of list) if (a.lit > 0.4) a.draw(t);
  }
};
