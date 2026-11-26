/*
 * A herd of little long-necked dinosaurs, and a tyrannosaurus or two among them.
 * Click: the little ones the wave reaches bolt away. The tyrannosaurus stops,
 * roars (the screen shakes, everyone near it scatters) and stomps towards the spot.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, makeCells, paintCell, pupil, spark } from "../world.js";

/* side view, facing right. B body, s spot, H head, E eye, m teeth, a arm, T tail, L leg */
const SMALL = [
  ".........HH.",
  ".........HEH",
  ".........H..",
  "T...BsBBBH..",
  "TT.BBBsBBB..",
  ".TTBBBBBBB.."
];
const SMALL_LEGS = { S: "...L.L.L.L..", A: "..L..L.L..L.", B: "...LL...LL.." };
const REX = [
  "......HHHH..",
  "......HEHHH.",
  "......HHmmm.",
  "T....BBH....",
  "TT..BBBBa...",
  ".TTBBsBBB...",
  "..TBBBBB...."
];
const REX_LEGS = { S: "....L..L....", A: "...L....L...", B: ".....LL....." };

let list = [], rexes = 0;

class Dino {
  constructor(x, y, rex) {
    this.x = x; this.y = y; this.rex = rex;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "stand"; this.tm = rand(0.3, 3);
    this.vx = 0; this.vy = 0; this.fr = 0; this.frT = 0; this.react = null;
    this.cs = cell() * (rex ? 1.2 : 0.75) * rand(0.9, 1.1);
    this.rad = this.cs * (rex ? 5 : 4.4); this.ay = 0.6;
    const hue = rex ? pick([6, 14, 100]) : pick([95, 140, 172, 40, 285, 200]), tint = rand(-4, 4);
    const paint = ch => {
      const n = Math.random();
      if (ch === "E") return ["#f6f6f2", null];
      if (ch === "m") return ["#f4f1e6", null];
      const l = (ch === "s" ? 30 : ch === "L" || ch === "T" ? 38 : 44) + n * 7 + tint;
      return [`hsl(${hue},${rex ? 62 : 52}%,${l}%)`, "rgba(255,255,230,.3)"];
    };
    const rows = rex ? REX : SMALL, legs = rex ? REX_LEGS : SMALL_LEGS;
    const pose = k => makeCells(rows.concat(legs[k]), 6, rows.length + 0.5, paint);
    this.poses = { S: pose("S"), A: pose("A"), B: pose("B") };
  }

  get soft() { return this.st === "stand" || this.st === "walk"; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, d, k }; }

  flee(ang, k) {
    const sp = (230 + 190 * k) * Math.max(0.5, cfg.speed);
    this.vx = Math.cos(ang) * sp; this.vy = Math.sin(ang) * sp * 0.6;
    this.dir = this.vx >= 0 ? 1 : -1;
    this.st = "run"; this.tm = (0.5 + 0.9 * k) * cfg.dino.flee;
  }

  roar(r) {
    this.st = "roar"; this.tm = 1.1;
    this.goal = { x: this.x - Math.cos(r.ang) * r.d, y: this.y - Math.sin(r.ang) * r.d };
    this.dir = this.goal.x >= this.x ? 1 : -1;
    world.shake = Math.max(world.shake, cfg.dino.shake * (0.7 + 0.6 * r.k));
    "RAWR!".split("").forEach((ch, i) => spark({ x: this.x + this.dir * this.cs * (6 + i * 1.6), y: this.y - this.cs * 7.5, vx: this.dir * rand(30, 70), vy: rand(-70, -30), life: 1.1, ch, c: "#ffd25e", g: 60 }));
    for (const o of list) {                                    // everyone nearby runs from it
      if (o.rex) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < 320) o.flee(Math.atan2(o.y - this.y, o.x - this.x) + rand(-0.4, 0.4), 1 - d / 320);
    }
  }

  bounce(m) {
    const { W, H } = world;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); this.dir = 1; }
    else if (this.x > W - m) { this.x = W - m; this.vx = -Math.abs(this.vx); this.dir = -1; }
    if (this.y < m + 50) { this.y = m + 50; this.vy = Math.abs(this.vy); }
    else if (this.y > H - 30) { this.y = H - 30; this.vy = -Math.abs(this.vy); }
  }

  step(dt, gap) {
    this.frT -= dt;
    if (this.frT > 0) return false;
    this.fr ^= 1; this.frT = gap;
    return true;
  }

  update(dt) {
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const r = this.react; this.react = null;
        if (this.rex) this.roar(r); else this.flee(r.ang + rand(-0.3, 0.3), r.k);
      }
    }
    this.tm -= dt;
    switch (this.st) {
      case "stand":
        if (this.tm <= 0) {
          const a = rand(0, Math.PI * 2), sp = (this.rex ? rand(26, 40) : rand(34, 60)) * cfg.speed;
          this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.5;
          this.dir = this.vx >= 0 ? 1 : -1;
          this.st = "walk"; this.tm = rand(1.5, 5);
        }
        break;
      case "walk":
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.bounce(80); this.step(dt, (this.rex ? 0.32 : 0.18) / Math.max(0.3, cfg.speed));
        if (this.tm <= 0) { this.st = "stand"; this.tm = rand(0.8, 3.5); }
        break;
      case "run":
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.bounce(80);
        if (this.step(dt, 0.07)) spark({ x: this.x - this.dir * this.cs * 4, y: this.y, vx: -this.dir * rand(10, 50), vy: rand(-60, -15), life: rand(0.25, 0.5), ch: ".", c: "#b9a98a" });
        if (this.tm <= 0) { this.st = "stand"; this.tm = rand(1, 3); }
        break;
      case "roar":
        if (this.tm <= 0) { this.st = "stomp"; this.tm = 3; }
        break;
      case "stomp": {                                          // heavy steps towards where the click was
        const dx = this.goal.x - this.x, dy = this.goal.y - this.y, d = Math.hypot(dx, dy);
        if (d < 30 || this.tm <= 0) { this.st = "stand"; this.tm = rand(1, 3); break; }
        const sp = 75 * Math.max(0.5, cfg.speed);
        this.x += dx / d * sp * dt; this.y += dy / d * sp * dt;
        this.dir = dx >= 0 ? 1 : -1; this.bounce(80);
        if (this.step(dt, 0.3)) world.shake = Math.max(world.shake, cfg.dino.shake * 0.22);
        break;
      }
    }
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs;
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#000";
    ctx.fillRect(this.x - cs * 5 + 3, this.y - cs * 0.35, cs * 10, cs * 1.1);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, flip = this.dir < 0 ? -1 : 1;
    const moving = this.st === "walk" || this.st === "run" || this.st === "stomp";
    const cells = moving ? (this.fr ? this.poses.A : this.poses.B) : this.poses.S;
    const roar = this.st === "roar", shiver = roar ? Math.sin(t * 60) * 1.2 : 0;
    const bob = moving && this.fr ? -cs * 0.25 : 0;
    for (const c of cells) {
      const px = this.x + shiver + c.ox * flip * cs;
      let py = this.y + bob + c.oy * cs;
      if (roar && c.ch === "m") {                              // the jaw drops
        ctx.fillStyle = "#7a1420"; ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
        py += cs * 0.9;
      }
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px + flip * cs * 0.1, py, cs * (roar ? 0.16 : 0.24));
    }
  }
}

export default {
  id: "dino", dot: "#8fd16a", theme: "hearth", particles: "embers",
  density: 1 / 120000, margin: 110, glyphScale: 0.8,

  init(animals) { list = animals; rexes = 0; },
  /* the first few made are the tyrannosauruses */
  make(x, y) {
    const rex = rexes < cfg.dino.rex;
    if (rex) rexes++;
    return new Dino(x, y, rex);
  }
};
