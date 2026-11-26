/*
 * Butterflies, seen from above, flutter about and rest now and then.
 * Click: a flower grows there; butterflies nearby fly over, land on it and sip.
 * Right-click scatters them.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, angDiff, makeCells, paintCell, spark, lureReach } from "../world.js";

/* head up. W wing, w wing edge, b body */
const ROWS = [
  "Ww...wW",
  "WWW.WWW",
  "wWWbWWw",
  ".WWbWW.",
  ".wWbWw.",
  ".ww.ww."
];
const BS = 0.75;
const WINGS = [
  { w: [28, 92, 56], e: [18, 40, 14] },      // monarch
  { w: [205, 88, 60], e: [228, 60, 22] },    // morpho
  { w: [52, 94, 62], e: [28, 75, 38] },      // brimstone
  { w: [330, 78, 70], e: [300, 45, 36] },
  { w: [0, 0, 95], e: [210, 12, 62] },       // cabbage white
  { w: [275, 68, 64], e: [255, 50, 28] },
  { w: [160, 70, 55], e: [180, 60, 22] }
];

/* the flower, cell by cell, with how far each cell is from the centre (it opens outwards) */
const FLOWER = [];
[".PPP.", "PPpPP", "PpYpP", "PPpPP", ".PPP."].forEach((row, r) => {
  for (let c = 0; c < 5; c++) if (row[c] !== ".") FLOWER.push({ ox: c - 2, oy: r - 2, ch: row[c], d: Math.hypot(c - 2, r - 2) });
});
FLOWER.push({ ox: -3, oy: 1, ch: "L", d: 3 }, { ox: 3, oy: -1, ch: "L", d: 3 }, { ox: -3, oy: 2, ch: "L", d: 3.4 }, { ox: 3, oy: -2, ch: "L", d: 3.4 });
const SLOTS = [[-1.8, -1.4], [1.9, -0.5], [-0.4, 2.1]];

let list = [];
const flowers = [];
const fcs = () => cell() * 0.62;

class Butterfly {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.a = rand(0, TAU); this.va = 0;
    this.base = rand(55, 95); this.ph = rand(0, 6); this.bobPh = rand(0, 6);
    this.st = "fly"; this.tm = 0; this.lift = 16;
    this.cool = rand(0, 3); this.restT = rand(5, 16); this.burst = 0;
    this.flower = null; this.slot = -1; this.react = null;
    this.cs = cell() * BS * rand(0.8, 1.15); this.rad = this.cs * 3; this.ay = 1;
    const sc = pick(WINGS);
    this.cells = makeCells(ROWS, 3, 2.5, ch => {
      const n = Math.random();
      if (ch === "b") return ["hsl(30,18%,16%)", null];
      const [h, s, l] = ch === "w" ? sc.e : sc.w;
      return [`hsl(${h},${s}%,${l + n * 8 - 4}%)`, l > 50 ? "rgba(60,40,30,.25)" : "rgba(255,240,220,.3)"];
    });
  }

  get soft() { return false; }
  get landed() { return this.st === "sip" || this.st === "rest"; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  leave() {
    if (this.flower && this.slot >= 0 && this.flower.slots[this.slot] === this) this.flower.slots[this.slot] = null;
    this.flower = null; this.slot = -1;
  }

  takeOff(ang, burst) {
    this.leave();
    this.st = "fly"; this.cool = rand(4, 9); this.restT = rand(6, 16);
    if (ang !== undefined) this.a = ang;
    this.burst = burst || 0;
  }

  findFlower() {
    let best = null, bd = Math.min(lureReach(), 620);
    for (const f of flowers) {
      if (f.life - f.age < 4 || f.age < 0.4) continue;
      const slot = f.slots.indexOf(null);
      if (slot < 0) continue;
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < bd) { bd = d; best = f; }
    }
    if (!best) return false;
    this.flower = best; this.slot = best.slots.indexOf(null); best.slots[this.slot] = this;
    this.st = "to";
    return true;
  }

  update(dt, t) {
    const { W, H } = world, fl = cfg.butterfly.flutter, speed = cfg.speed;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) { const r = this.react; this.react = null; this.takeOff(r.ang + rand(-0.5, 0.5), 0.5 + r.k); }
    }
    this.ph += dt * (this.landed ? 2.4 : 15 * fl + (this.burst > 0 ? 8 : 0));
    let lift = 16;
    switch (this.st) {
      case "fly": {
        this.va += rand(-14, 14) * dt * fl; this.va *= Math.pow(0.25, dt);
        this.a += this.va * dt * 2.2;
        const m = 70;
        if (this.x < m || this.x > W - m || this.y < m || this.y > H - m) {
          this.a += clamp(angDiff(Math.atan2(H / 2 - this.y, W / 2 - this.x), this.a), -3.5 * dt, 3.5 * dt);
        }
        let v = this.base * speed;
        if (this.burst > 0) { this.burst -= dt; v *= 3.2; }
        this.x += Math.cos(this.a) * v * dt;
        this.y += Math.sin(this.a) * v * dt + Math.sin(t * 6 + this.bobPh) * 16 * fl * dt;
        this.x = clamp(this.x, -20, W + 20); this.y = clamp(this.y, -20, H + 20);
        this.cool -= dt; this.restT -= dt;
        if (this.burst <= 0) {
          if (this.cool <= 0 && flowers.length && this.findFlower()) break;
          if (this.restT <= 0) { this.st = "rest"; this.tm = rand(2, 5); }
        }
        break;
      }
      case "to": {
        const f = this.flower;
        if (!f || f.gone || f.life - f.age < 1) { this.takeOff(); break; }
        const s = fcs(), tx = f.x + SLOTS[this.slot][0] * s, ty = f.y + SLOTS[this.slot][1] * s;
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
        if (d < 5) { this.x = tx; this.y = ty; this.st = "sip"; this.tm = rand(3, 8); this.a = Math.atan2(f.y - ty, f.x - tx); break; }
        this.a += clamp(angDiff(Math.atan2(dy, dx), this.a), -7 * dt, 7 * dt);
        const v = Math.min(130 * speed, d * 3 + 30);
        this.x += dx / d * v * dt; this.y += dy / d * v * dt;
        lift = Math.min(16, d * 0.2);
        break;
      }
      case "sip":
        lift = 0; this.tm -= dt;
        if (this.tm <= 0 || !this.flower || this.flower.gone || this.flower.life - this.flower.age < 0.6) this.takeOff();
        break;
      case "rest":
        lift = 0; this.tm -= dt;
        if (this.tm <= 0) this.takeOff();
        break;
    }
    this.lift += (lift - this.lift) * Math.min(1, dt * 6);
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs, f = 0.3 + 0.7 * Math.abs(Math.sin(this.ph));
    ctx.globalAlpha = 0.2; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(this.x + this.lift * 0.5, this.y + this.lift * 0.9 + 3, cs * 3 * f + 2, cs * 1.6, this.a + Math.PI / 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs;
    const f = (this.landed ? 0.45 : 0.3) + (this.landed ? 0.55 : 0.7) * Math.abs(Math.sin(this.ph));
    ctx.save();
    ctx.translate(this.x, this.y - this.lift); ctx.rotate(this.a + Math.PI / 2);
    for (const c of this.cells) {
      if (c.ch === "b") paintCell(c, 0, c.oy * cs, cs, t, cs * 0.8);
      else paintCell(c, c.ox * cs * f, c.oy * cs, cs, t, Math.max(2, cs * f + 1));
    }
    ctx.restore();
  }
}

function plant(x, y) {
  while (flowers.filter(f => !f.gone).length >= cfg.butterfly.maxFlowers) {
    const old = flowers.find(f => !f.gone);
    old.age = Math.max(old.age, old.life - 1.2); old.gone = true;      // wilts quickly
  }
  const hue = pick([330, 350, 280, 45, 20, 200, 0]);
  flowers.push({ x, y, age: 0, life: cfg.butterfly.flowerLife * rand(0.85, 1.15), hue, slots: [null, null, null], gone: false });
  for (let i = 0; i < 9; i++) {
    const a = rand(0, TAU), v = rand(40, 140);
    spark({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rand(0.4, 0.8), ch: pick(["*", ".", "+"]), c: `hsl(${hue},80%,75%)`, g: 160 });
  }
  for (const b of list) {                                       // the ones right under the click are startled
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < 90) b.takeOff(Math.atan2(b.y - y, b.x - x), 0.6);
  }
}

export default {
  id: "butterfly", dot: "#ff8fc7", theme: "dusk", particles: "sakura",
  density: 1 / 85000, margin: 60, glyphScale: BS, separate: false,

  init(animals) { list = animals; flowers.length = 0; },
  make: (x, y) => new Butterfly(x, y),

  poke(x, y) { plant(x, y); return true; },

  update(dt) {
    for (let i = flowers.length - 1; i >= 0; i--) {
      const f = flowers[i];
      f.age += dt;
      if (f.age >= f.life) { f.gone = true; flowers.splice(i, 1); }
    }
  },

  under() {
    const ctx = world.ctx, s = fcs();
    for (const f of flowers) {
      const p = Math.min(1, f.age / 0.8), open = (1 - Math.pow(1 - p, 3)) * 3.6;      // opens from the centre out
      const left = f.life - f.age, wilt = left < 2 ? left / 2 : 1;
      ctx.globalAlpha = wilt;
      for (const c of FLOWER) {
        if (c.d > open) continue;
        const k = 0.75 + 0.25 * wilt;
        ctx.fillStyle = c.ch === "Y" ? "hsl(48,95%,60%)" : c.ch === "p" ? `hsl(${f.hue},85%,80%)` : c.ch === "L" ? "hsl(130,45%,36%)" : `hsl(${f.hue},75%,${62 + ((c.ox * 3 + c.oy * 5) & 3) * 2}%)`;
        ctx.fillRect(f.x + c.ox * s * k - s / 2, f.y + c.oy * s * k - s / 2, s - 1, s - 1);
      }
    }
    ctx.globalAlpha = 1;
  }
};
