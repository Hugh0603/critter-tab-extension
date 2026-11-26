/* Frogs (seen from above) hop around; click and they hop away from the spot. */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, paintCell, pupil, HAT_COLORS } from "../world.js";

const F_SPRITE = [
  "...P...",
  "..HHH..",
  ".EWWWE.",
  ".ggggg.",
  "xgglggx",
  ".ggggg.",
  ".gg.gg.",
  "xx...xx"
];
const F_NO_HAT = [".......", ".......", ".E...E.", ".ggggg.", "xgglggx", ".ggggg.", ".gg.gg.", "xx...xx"];

const trail = [];
const isHat = c => c.ch === "H" || c.ch === "W" || c.ch === "P";

class Frog {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.k = Math.floor(Math.random() * 4);
    this.state = "idle"; this.timer = rand(0.3, 4);
    this.h = 0; this.react = null; this.hops = 0; this.trailT = 0;
    this.cs = cell(); this.rad = this.cs * 2.7; this.ay = 1;
    const sprite = cfg.hats ? F_SPRITE : F_NO_HAT;
    const hat = pick(HAT_COLORS), tint = rand(-5, 5);
    const cells = [];
    for (let r = 0; r < sprite.length; r++) {
      for (let c = 0; c < sprite[r].length; c++) {
        const ch = sprite[r][c]; if (ch === ".") continue;
        const n = Math.random(); let fill, gc = null;
        if (ch === "g") { fill = `hsl(124,44%,${24 + n * 9 + tint}%)`; gc = "rgba(214,255,190,.5)"; }
        else if (ch === "l") { fill = `hsl(76,38%,${46 + n * 8 + tint}%)`; gc = "rgba(214,255,190,.5)"; }
        else if (ch === "x") { fill = `hsl(122,46%,${30 + n * 8 + tint}%)`; gc = "rgba(214,255,190,.5)"; }
        else if (ch === "H") fill = hat;
        else if (ch === "E") fill = "#f6f6f2";
        else fill = "#f2f6f8";
        cells.push({ ox: c + 0.5 - 3.5, oy: r + 0.5 - 4, ch, fill, gc, ph: Math.random() * 6 });
      }
    }
    this.cells = cells.filter(c => !isHat(c)).concat(cells.filter(isHat));
  }

  get soft() { return this.state === "idle"; }

  hit(ang, d, k) {
    this.react = { delay: d / cfg.wave, ang: ang + rand(-0.35, 0.35), dist: (150 + 330 * k) * cfg.frog.kick, dur: 0.34 / Math.max(0.2, cfg.speed), hops: Math.floor(k * 2.6) };
  }

  leapTo(ang, dist, dur) {
    const { W, H } = world, m = 64;
    let tx = this.x + Math.cos(ang) * dist, ty = this.y + Math.sin(ang) * dist;
    if (tx < m) tx = m + (m - tx);
    if (tx > W - m) tx = W - m - (tx - (W - m));
    if (ty < m) ty = m + (m - ty);
    if (ty > H - m) ty = H - m - (ty - (H - m));
    tx = Math.min(W - m, Math.max(m, tx)); ty = Math.min(H - m, Math.max(m, ty));
    this.sx = this.x; this.sy = this.y; this.tx = tx; this.ty = ty;
    this.t = 0; this.dur = dur; this.state = "leap";
    const heading = Math.atan2(ty - this.sy, tx - this.sx);
    this.k = ((Math.round((heading + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
  }

  update(dt) {
    const speed = Math.max(0.2, cfg.speed);
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) { const r = this.react; this.react = null; this.hops = r.hops; this.leapTo(r.ang, r.dist, r.dur); }
    }
    if (this.state === "idle") {
      this.h = 0; this.timer -= dt;
      if (this.timer <= 0) { this.leapTo(rand(0, Math.PI * 2), rand(70, 190), rand(0.45, 0.7) / speed); this.hops = 0; }
      return;
    }
    this.t += dt;
    const p = Math.min(1, this.t / this.dur), e = 1 - (1 - p) * (1 - p);
    this.x = this.sx + (this.tx - this.sx) * e; this.y = this.sy + (this.ty - this.sy) * e;
    this.h = Math.sin(Math.PI * p);
    if (cfg.frog.trail) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.035; trail.push({ x: this.x, y: this.y, a: 1 }); }
    }
    if (p >= 1) {
      this.h = 0;
      if (this.hops > 0) {
        this.hops--;
        this.leapTo(Math.atan2(this.ty - this.sy, this.tx - this.sx) + rand(-0.5, 0.5), rand(120, 260) * cfg.frog.kick, 0.3 / speed);
      } else { this.state = "idle"; this.timer = rand(1.5, 5.5); }
    }
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs, s = 1 - 0.25 * this.h, w = 5.4 * cs * s, h = 6.6 * cs * s;
    ctx.globalAlpha = 0.28 * (1 - 0.5 * this.h); ctx.fillStyle = "#000";
    ctx.fillRect(this.x - w / 2 + 4, this.y - h / 2 + 8, w, h);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const cs = this.cs, s = 1 + 0.32 * this.h, lift = this.h * 24 * cfg.size, size = cs * s;
    const th = this.k * Math.PI / 2, co = Math.round(Math.cos(th)), si = Math.round(Math.sin(th));
    const hx = 0.5 * si, hy = -0.5 * co;   // the hat stays upright on top of the frog
    for (const c of this.cells) {
      const hat = isHat(c);
      const rx = hat ? hx + c.ox : c.ox * co - c.oy * si;
      const ry = hat ? hy + (c.oy + 1.5) : c.ox * si + c.oy * co;
      const px = this.x + rx * size, py = this.y - lift + ry * size;
      paintCell(c, px, py, size, t);
      if (c.ch === "E") pupil(px, py, size * 0.2);
    }
  }
}

export default {
  id: "frog", dot: "#69d36e", theme: "swamp", particles: "rain",
  density: 1 / 60000, margin: 70, glyphScale: 1,

  init() { trail.length = 0; },
  make: (x, y) => new Frog(x, y),

  update(dt) {
    for (let i = trail.length - 1; i >= 0; i--) { trail[i].a -= dt / 1.3; if (trail[i].a <= 0) trail.splice(i, 1); }
  },

  under() {
    const ctx = world.ctx;
    for (const p of trail) { ctx.fillStyle = `rgba(120,220,130,${(p.a * 0.35).toFixed(3)})`; ctx.fillText(".", p.x, p.y); }
  }
};
