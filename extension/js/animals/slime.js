/*
 * Slimes hop about, squashing when they land. They come in three sizes.
 * Click: the ones the wave reaches split into two smaller slimes that pop apart;
 * after a while slimes of the same size find each other and merge back.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, shimmer, spark } from "../world.js";

const SS = 0.85;
const DIM = [null, [5, 3], [7, 5], [9, 7]];        // width, height in cells for each size
const HUES = [130, 190, 280, 330, 45, 0];

let list = [];

/* a dome of cells standing on the ground line, with two eyes */
function dome(w, h) {
  const out = [], eyeX = Math.max(1, Math.round(w * 0.2)), eyeJ = Math.floor(h * 0.45);
  for (let j = 0; j < h; j++) {                     // j = 0 is the bottom row
    const k = j / h, half = (w / 2) * Math.sqrt(1 - k * k);
    for (let i = 0; i < w; i++) {
      const ox = i - (w - 1) / 2;
      if (Math.abs(ox) > half - 0.2) continue;
      const eye = j === eyeJ && Math.abs(ox) === eyeX;
      out.push({ ox, oy: -(j + 0.5), ch: eye ? "E" : "S", sh: ox < 0 && j > h / 2 ? 2 : Math.floor(Math.random() * 2), ph: Math.random() * 6 });
    }
  }
  return out;
}

class Slime {
  constructor(x, y, L, hue) {
    this.x = x; this.y = y;
    this.L = L || pick([1, 2, 2, 3, 3]);
    this.hue = hue === undefined ? pick(HUES) : hue;
    this.st = "idle"; this.tm = rand(0.3, 2.5);
    this.sq = 0; this.lift = 0; this.mergeT = 0; this.react = null; this.ph = rand(0, 6);
    this.build();
  }

  build() {
    const [w, h] = DIM[this.L];
    this.w = w; this.cs = cell() * SS;
    this.cells = dome(w, h);
    this.rad = this.cs * w * 0.55; this.ay = 0.6;
    this.shades = [46, 53, 64].map(l => `hsla(${this.hue},72%,${l}%,.9)`);
  }

  get soft() { return this.st === "idle"; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  jump(ang, dist, now) {
    const { W, H } = world;
    this.sx0 = this.x; this.sy0 = this.y;
    this.tx = clamp(this.x + Math.cos(ang) * dist, 60, W - 60);
    this.ty = clamp(this.y + Math.sin(ang) * dist * 0.7, 100, H - 40);
    this.dur = 0.4 + dist / 650; this.peak = (16 + dist * 0.28) * cfg.slime.bounce;
    this.t = 0;
    if (now) this.st = "air"; else { this.st = "charge"; this.tm = 0.18; }
  }

  goo(n) {
    for (let i = 0; i < n; i++) spark({ x: this.x + rand(-this.rad, this.rad), y: this.y - this.cs, vx: rand(-90, 90), vy: rand(-170, -50), life: rand(0.3, 0.6), ch: pick(["o", ".", "*"]), c: `hsl(${this.hue},80%,68%)` });
  }

  /* hit by the wave: split in two, or just leap away if it is already the smallest */
  pop(ang, k) {
    this.goo(6);
    if (this.L > 1 && list.length < 500) {
      this.L--; this.build();
      const twin = new Slime(this.x, this.y, this.L, this.hue);
      list.push(twin);
      this.mergeT = twin.mergeT = cfg.slime.merge * rand(0.8, 1.4);
      this.jump(ang - rand(0.6, 1.1), 90 + 170 * k, true);
      twin.jump(ang + rand(0.6, 1.1), 90 + 170 * k, true);
    } else this.jump(ang + rand(-0.4, 0.4), 120 + 220 * k, true);
  }

  update(dt) {
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) { const r = this.react; this.react = null; this.pop(r.ang, r.k); }
    }
    if (this.mergeT > 0) this.mergeT -= dt;
    if (this.sq > 0) this.sq -= dt;
    switch (this.st) {
      case "idle":
        this.tm -= dt;
        if (this.tm <= 0) {
          let mate = null, bd = 600;                          // ready to merge: hop towards one its own size
          if (this.L < 3 && this.mergeT <= 0) {
            for (const o of list) {
              if (o === this || o.L !== this.L || o.mergeT > 0) continue;
              const d = Math.hypot(o.x - this.x, o.y - this.y);
              if (d < bd) { bd = d; mate = o; }
            }
          }
          if (mate) this.jump(Math.atan2(mate.y - this.y, mate.x - this.x), Math.min(bd, 120) * cfg.speed);
          else this.jump(rand(0, TAU), rand(40, 130) * cfg.speed);
        }
        break;
      case "charge":
        this.tm -= dt;
        if (this.tm <= 0) this.st = "air";
        break;
      case "air": {
        this.t += dt;
        const p = Math.min(1, this.t / this.dur);
        this.x = this.sx0 + (this.tx - this.sx0) * p; this.y = this.sy0 + (this.ty - this.sy0) * p;
        this.lift = Math.sin(Math.PI * p) * this.peak;
        if (p >= 1) { this.lift = 0; this.st = "idle"; this.tm = rand(0.3, 2) / Math.max(0.3, cfg.speed); this.sq = 0.22; this.goo(2); }
        break;
      }
    }
  }

  shadow() {
    const ctx = world.ctx, k = 1 - Math.min(0.5, this.lift / 160);
    ctx.globalAlpha = 0.26 * k; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(this.x + 2, this.y, this.rad * 1.05 * k, this.cs * 0.9, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs;
    let sx = 1, sy = 1 + Math.sin(t * 3 + this.ph) * 0.04;
    if (this.st === "charge") { sx = 1.2; sy = 0.72; }
    else if (this.st === "air") { const s = Math.sin(Math.PI * Math.min(1, this.t / this.dur)); sx = 1 - 0.12 * s; sy = 1 + 0.2 * s; }
    else if (this.sq > 0) { const s = this.sq / 0.22; sx = 1 + 0.3 * s; sy = 1 - 0.3 * s; }
    const w = cs * sx, h = cs * sy;
    for (const c of this.cells) {
      const px = this.x + c.ox * w, py = this.y - this.lift + c.oy * h;
      if (c.ch === "E") {
        ctx.fillStyle = "#10131c"; ctx.fillRect(px - w / 2, py - h / 2, w - 1, h - 1);
        ctx.fillStyle = "#fff"; ctx.fillRect(px - w / 2 + 1, py - h / 2 + 1, w * 0.35, h * 0.35);
        continue;
      }
      ctx.fillStyle = this.shades[c.sh]; ctx.fillRect(px - w / 2, py - h / 2, w - 1, h - 1);
      if (world.glyphsOn) { ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillText(shimmer(c, t), px, py); }
    }
  }
}

export default {
  id: "slime", dot: "#7ee06a", theme: "dusk", particles: "fireflies",
  density: 1 / 150000, margin: 100, glyphScale: SS,

  init(animals) { list = animals; },
  make: (x, y) => new Slime(x, y),

  /* two resting slimes of the same size that touch become one bigger slime */
  update() {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.L >= 3 || a.mergeT > 0 || a.st !== "idle") continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.L !== a.L || b.mergeT > 0 || b.st !== "idle") continue;
        if (Math.hypot(b.x - a.x, (b.y - a.y) * 0.6) > (a.rad + b.rad) * 1.3) continue;
        a.x = (a.x + b.x) / 2; a.y = (a.y + b.y) / 2;
        a.L++; a.build(); a.sq = 0.22; a.mergeT = 1.5; a.goo(8);
        list.splice(j, 1);
        break;
      }
    }
  }
};
