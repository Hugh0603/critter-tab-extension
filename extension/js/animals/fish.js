/*
 * Koi, seen from above. They drift around the pond with a lazy tail beat.
 * Click: food pellets drop on the water, the fish that notice swim over and eat.
 * Right-click (or "Scare" in the settings): they dart away from the spot.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, angDiff, makeCells, paintCell, pupil, spark, lureReach } from "../world.js";

/* facing right. B body, b tail root, T tail, f fin, e eye */
const ROWS = [
  "......f.....",
  "T...bBBBB...",
  "TT.bBBBBBBe.",
  ".TTBBBBBBBBB",
  "TT.bBBBBBBe.",
  "T...bBBBB...",
  "......f....."
];
const CX = 6, CY = 3, FS = 0.72;

const KOI = [
  { base: [30, 25, 90], patch: [10, 85, 52] },      // white with red
  { base: [24, 92, 54], patch: [40, 30, 92] },      // orange with white
  { base: [44, 92, 56], patch: [30, 90, 46] },      // gold
  { base: [225, 14, 15], patch: [12, 85, 52] },     // black with red
  { base: [40, 20, 92], patch: [225, 14, 16] },     // white with black
  { base: [205, 32, 46], patch: [16, 78, 56] }      // blue-grey with orange
];
function scheme() {
  const p = cfg.fish.palette;
  if (p === "gold") { const h = rand(16, 40); return { base: [h, 92, 54], patch: [h + 10, 95, 68] }; }
  if (p === "tropical") { const h = rand(0, 360); return { base: [h, 85, 56], patch: [(h + rand(120, 200)) % 360, 90, 62] }; }
  return pick(KOI);
}

const food = [], rings = [];
const ring = (x, y, big) => { if (cfg.fish.rings && rings.length < 90) rings.push({ x, y, t: 0, life: big ? 1.1 : 0.7, grow: big ? 46 : 26 }); };

class Fish {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.a = rand(0, TAU); this.goal = this.a;
    this.pace = rand(0.75, 1.3); this.sp = 30 * this.pace;
    this.cs = cell() * FS * rand(0.8, 1.2);
    this.rad = this.cs * 3.2; this.ay = 1;
    this.wig = rand(0, 6); this.turnT = rand(0.5, 3);
    this.dart = 0; this.react = null; this.out = false;
    const sc = scheme(), s1 = rand(0, 9), s2 = rand(0, 9);
    this.cells = makeCells(ROWS, CX, CY, (ch, c, r) => {
      const n = Math.random();
      const spot = Math.sin(c * 1.9 + s1) + Math.cos(r * 2.7 + s2) > 0.35;
      let [h, s, l] = spot && ch !== "T" && ch !== "f" ? sc.patch : sc.base;
      if (ch === "b") l -= 6;
      if (ch === "T" || ch === "f") return [`hsla(${h},${s}%,${Math.min(94, l + 8 + n * 6)}%,.78)`, null];
      const fill = `hsl(${h},${s}%,${l + n * 7 - 3}%)`;
      if (ch === "e") return [fill, null];
      return [fill, l > 65 ? "rgba(70,45,25,.3)" : "rgba(255,240,220,.3)"];
    });
  }

  get soft() { return true; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  /* the nearest pellet that has landed and is close enough to notice */
  seek() {
    let best = null, bd = lureReach();
    for (const f of food) {
      if (f.z > 0 || f.gone) continue;
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  update(dt) {
    const { W, H } = world, m = 60;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        this.a = this.goal = this.react.ang + rand(-0.4, 0.4);
        this.dart = 0.45 + this.react.k * 0.8; this.react = null;
      }
    }
    let want = 32 * this.pace * cfg.speed, turnRate = 1.6;
    const f = this.dart > 0 ? null : this.seek();
    if (this.dart > 0) { this.dart -= dt; want = 330; }
    else if (f) {
      const hx = this.x + Math.cos(this.a) * this.cs * 5, hy = this.y + Math.sin(this.a) * this.cs * 5;
      const d = Math.hypot(f.x - hx, f.y - hy);
      this.goal = Math.atan2(f.y - this.y, f.x - this.x);
      want = clamp(d * 1.5, 55, 200) * cfg.fish.appetite * this.pace; turnRate = 4.5;
      if (d < this.cs * 1.8) {                                  // gulp
        f.gone = true; this.sp *= 0.5;
        ring(f.x, f.y, false);
        spark({ x: f.x, y: f.y, vx: rand(-14, 14), vy: rand(-30, -12), life: 0.7, ch: "o", c: "#cfeaff", g: -30 });
      }
    } else {
      this.turnT -= dt;
      if (this.turnT <= 0) {
        this.goal = this.a + rand(-1.3, 1.3); this.turnT = rand(1.2, 4.5);
        if (Math.random() < 0.06) ring(this.x + Math.cos(this.a) * this.cs * 5, this.y + Math.sin(this.a) * this.cs * 5, false);
      }
    }
    /* near the edge: turn back towards the middle */
    const out = this.x < m || this.x > W - m || this.y < m || this.y > H - m;
    if (out && (!this.out || this.turnT <= 0.05) && !f) {
      this.goal = Math.atan2(H / 2 - this.y + rand(-140, 140), W / 2 - this.x + rand(-200, 200));
      this.turnT = rand(1.5, 3); if (this.dart > 0) this.a = this.goal;
    }
    this.out = out;

    const d = angDiff(this.goal, this.a);
    this.a += clamp(d * 3.2 * dt, -turnRate * dt, turnRate * dt);
    this.sp += (want - this.sp) * Math.min(1, dt * 3);
    this.x = clamp(this.x + Math.cos(this.a) * this.sp * dt, -30, W + 30);
    this.y = clamp(this.y + Math.sin(this.a) * this.sp * dt, -30, H + 30);
    this.wig += dt * (3 + this.sp * 0.075);
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs;
    ctx.save();
    ctx.translate(this.x + 6, this.y + 10); ctx.rotate(this.a);
    ctx.globalAlpha = 0.22; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(-cs * 0.4, 0, cs * 5.4, cs * 2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs;
    const amp = cs * (0.35 + Math.min(1, this.sp / 170) * 0.75);
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.a);
    for (const c of this.cells) {
      const k = c.ox < 1 ? Math.min(1, (1 - c.ox) / 6) : 0;       // the tail swings, the head barely
      const py = c.oy * cs + Math.sin(this.wig + c.ox * 0.6) * amp * k * k;
      paintCell(c, c.ox * cs, py, cs, t);
      if (c.ch === "e") pupil(c.ox * cs, py, cs * 0.24);
    }
    ctx.restore();
  }
}

function feed(x, y) {
  ring(x, y, true);
  for (let i = 0; i < cfg.fish.food; i++) {
    const a = rand(0, TAU), r = rand(0, 16 + cfg.fish.food * 6);
    if (food.length > 90) food.shift();
    food.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.8, z: rand(24, 80), vz: 0, vx: rand(-7, 7), vy: rand(-7, 7), age: 0, gone: false, ph: rand(0, 6) });
  }
}

export default {
  id: "fish", dot: "#ff9a4d", theme: "pond", particles: "leaves",
  density: 1 / 95000, margin: 70, glyphScale: FS,

  init() { food.length = 0; rings.length = 0; },
  make: (x, y) => new Fish(x, y),

  /* true: the click is fully handled here */
  poke(x, y) {
    if (cfg.fish.click !== "feed") return false;
    feed(x, y);
    return true;
  },

  update(dt) {
    for (let i = food.length - 1; i >= 0; i--) {
      const f = food[i];
      if (f.gone) { food.splice(i, 1); continue; }
      if (f.z > 0) {
        f.vz += 520 * dt; f.z -= f.vz * dt;
        if (f.z <= 0) { f.z = 0; ring(f.x, f.y, false); }
      } else {
        f.age += dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        f.vx *= Math.pow(0.5, dt); f.vy *= Math.pow(0.5, dt);
        if (f.age > 16) food.splice(i, 1);                       // sinks
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].life) rings.splice(i, 1); }
  },

  under() {
    const ctx = world.ctx;
    ctx.lineWidth = 1;
    for (const r of rings) {
      const p = r.t / r.life;
      ctx.strokeStyle = `rgba(190,235,255,${((1 - p) * 0.4).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, 3 + p * r.grow, 0, TAU); ctx.stroke();
      if (r.grow > 30 && p > 0.25) { ctx.beginPath(); ctx.arc(r.x, r.y, 3 + (p - 0.25) * r.grow, 0, TAU); ctx.stroke(); }
    }
  },

  over(t) {
    const ctx = world.ctx, s = Math.max(3, cell() * 0.36);
    for (const f of food) {
      const fade = f.age > 14 ? Math.max(0, (16 - f.age) / 2) : 1;
      if (f.z > 0) { ctx.globalAlpha = 0.2; ctx.fillStyle = "#000"; ctx.fillRect(f.x - s / 2 + 2, f.y - s / 2 + 3, s, s); }
      ctx.globalAlpha = fade;
      const bob = f.z > 0 ? 0 : Math.sin(t * 2.4 + f.ph) * 0.8;
      ctx.fillStyle = "#d9a55c"; ctx.fillRect(f.x - s / 2, f.y - f.z - s / 2 + bob, s, s);
      ctx.fillStyle = "#f3d59a"; ctx.fillRect(f.x - s / 2, f.y - f.z - s / 2 + bob, s * 0.5, s * 0.5);
    }
    ctx.globalAlpha = 1;
  }
};
