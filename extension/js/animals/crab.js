/*
 * Crabs scuttle sideways in bursts and wave their claws at each other.
 * Click: the ones the wave reaches dig into the sand so only their eyes
 * stick out, look around, then pop back up snapping their claws.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, makeCells, paintCell, pupil, spark } from "../world.js";

/* front view. R shell, C claw, E eye, L leg, s sand */
const DOWN = [
  "....E.E....",
  "CC.RRRRR.CC",
  "C.RRRRRRR.C",
  "..RRRRRRR.."
];
const UP = [
  "CC..E.E..CC",
  "C..RRRRR..C",
  ".CRRRRRRRC.",
  "..RRRRRRR.."
];
const SNAP = [
  "C...E.E...C",
  "C..RRRRR..C",
  ".CRRRRRRRC.",
  "..RRRRRRR.."
];
const LEGS = { A: ".L.L...L.L.", B: "L.L.....L.L" };
const HIDDEN = [
  "....E.E....",
  "..sRRRRRs.."
];
const CS = 0.8;

class Crab {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.st = "idle"; this.tm = rand(0.3, 3);
    this.vx = 0; this.vy = 0; this.fr = 0; this.frT = 0; this.cl = 0; this.clT = 0;
    this.react = null; this.eye = 0; this.eyeT = 0;
    this.cs = cell() * CS * rand(0.85, 1.15); this.rad = this.cs * 4.4; this.ay = 0.6;
    const hue = pick([6, 6, 16, 28, 205, 285]), tint = rand(-4, 4);
    const paint = ch => {
      const n = Math.random();
      if (ch === "E") return ["#f6f6f2", null];
      if (ch === "s") return [`hsl(40,34%,${40 + n * 10}%)`, null];
      if (ch === "C") return [`hsl(${hue},82%,${56 + n * 6 + tint}%)`, "rgba(255,240,220,.3)"];
      if (ch === "L") return [`hsl(${hue},62%,${36 + n * 6 + tint}%)`, null];
      return [`hsl(${hue},74%,${44 + n * 8 + tint}%)`, "rgba(255,240,220,.3)"];
    };
    const pose = (rows, legs) => makeCells(legs ? rows.concat(legs) : rows, 5, rows.length + (legs ? 1 : 0) - 0.5, paint);
    this.poses = {
      downA: pose(DOWN, LEGS.A), downB: pose(DOWN, LEGS.B),
      up: pose(UP, LEGS.A), snap: pose(SNAP, LEGS.A),
      hidden: pose(HIDDEN)
    };
  }

  get soft() { return this.st === "idle" || this.st === "scuttle" || this.st === "wave"; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, k }; }

  sand(n) {
    for (let i = 0; i < n; i++) spark({ x: this.x + rand(-this.cs * 4, this.cs * 4), y: this.y - this.cs, vx: rand(-80, 80), vy: rand(-150, -40), life: rand(0.3, 0.6), ch: pick([".", ".", "*"]), c: "#c9b48a" });
  }

  update(dt) {
    const { W, H } = world, m = 70;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const k = this.react.k; this.react = null;
        if (this.st !== "hide") this.sand(8);
        this.st = "hide"; this.tm = cfg.crab.hide * (0.6 + 0.8 * k) * rand(0.8, 1.2);
        this.eyeT = 0.4; this.eye = 0;
      }
    }
    this.tm -= dt;
    switch (this.st) {
      case "idle":
        if (this.tm <= 0) {
          if (Math.random() < cfg.crab.claws * 0.6) { this.st = "wave"; this.tm = rand(1, 2.2); this.clT = 0; }
          else {
            const dir = Math.random() < 0.5 ? 1 : -1, sp = rand(80, 150) * cfg.speed;
            this.vx = dir * sp; this.vy = rand(-0.25, 0.25) * sp;
            this.st = "scuttle"; this.tm = rand(0.4, 1.5);
          }
        }
        break;
      case "scuttle":
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); } else if (this.x > W - m) { this.x = W - m; this.vx = -Math.abs(this.vx); }
        if (this.y < m + 30) { this.y = m + 30; this.vy = Math.abs(this.vy); } else if (this.y > H - 30) { this.y = H - 30; this.vy = -Math.abs(this.vy); }
        this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.07; }
        if (this.tm <= 0) { this.st = "idle"; this.tm = rand(0.5, 3); }
        break;
      case "wave": case "pop":                                 // claws up, snapping
        this.clT -= dt; if (this.clT <= 0) { this.cl ^= 1; this.clT = this.st === "pop" ? 0.11 : 0.22; }
        if (this.tm <= 0) { this.st = "idle"; this.tm = rand(0.5, 2.5); }
        break;
      case "hide":                                             // only the eyes show, looking left and right
        this.eyeT -= dt; if (this.eyeT <= 0) { this.eye = pick([-1, 0, 1]); this.eyeT = rand(0.3, 0.8); }
        if (this.tm <= 0) { this.st = "pop"; this.tm = 0.9; this.clT = 0; this.eye = 0; this.sand(5); }
        break;
    }
  }

  shadow() {
    if (this.st === "hide") return;
    const ctx = world.ctx, cs = this.cs;
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#000";
    ctx.fillRect(this.x - cs * 5 + 3, this.y - cs * 0.35, cs * 10, cs * 1.1);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const cs = this.cs, P = this.poses;
    let cells, hop = 0;
    switch (this.st) {
      case "hide": cells = P.hidden; break;
      case "wave": cells = this.cl ? P.up : P.snap; break;
      case "pop": cells = this.cl ? P.up : P.snap; hop = Math.max(0, Math.sin((0.9 - this.tm) / 0.3 * Math.PI)) * (this.tm > 0.6 ? cs * 1.6 : 0); break;
      case "scuttle": cells = this.fr ? P.downA : P.downB; break;
      default: cells = P.downA;
    }
    const bob = this.st === "scuttle" ? (this.fr ? -cs * 0.2 : 0) : 0;
    for (const c of cells) {
      const px = this.x + c.ox * cs, py = this.y + bob - hop + c.oy * cs;
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px + this.eye * cs * 0.22, py, cs * 0.22);
    }
  }
}

export default {
  id: "crab", dot: "#ff6b57", theme: "sand", particles: "bubbles",
  density: 1 / 105000, margin: 90, glyphScale: CS,

  init() {},
  make: (x, y) => new Crab(x, y)
};
