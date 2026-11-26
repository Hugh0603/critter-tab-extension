/*
 * Spiders hang from the top of the screen on threads, swaying, letting
 * themselves down and climbing back. Click: the ones the wave reaches are
 * swung aside and zip up to the top, wait, then lower themselves cautiously.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, makeCells, paintCell } from "../world.js";

/* B body, E eye, l leg; two leg poses */
const POSES = [
  ["l.l...l.l", ".l.BBB.l.", "..lBBBl..", ".l.EBE.l.", "l.l.B.l.l"],
  [".l.....l.", "l.lBBBl.l", "..lBBBl..", "l..EBE..l", ".l..B..l."]
];
const SP = 0.8;

class Spider {
  constructor(x, y) {
    this.ax = x;                                               // where its thread is fixed, on the top edge
    this.len = clamp(y, 60, world.H - 80); this.goal = this.len;
    this.th = rand(-0.1, 0.1); this.om = 0;                    // swing angle and its speed
    this.st = "hang"; this.tm = rand(1, 6); this.react = null;
    this.fr = 0; this.frT = 0; this.ph = rand(0, 6);
    this.cs = cell() * SP * rand(0.75, 1.2); this.rad = this.cs * 4; this.ay = 1;
    this.x = x; this.y = this.len;
    const hue = pick([270, 270, 15, 200, 100]), eye = pick(["#ff5d6c", "#ffd25e", "#f6f6f2"]);
    const paint = ch => {
      const n = Math.random();
      if (ch === "E") return [eye, null];
      if (ch === "l") return [`hsl(${hue},14%,${30 + n * 8}%)`, null];
      return [`hsl(${hue},24%,${16 + n * 8}%)`, "rgba(220,200,255,.34)"];
    };
    this.poses = POSES.map(rows => makeCells(rows, 4, 2, paint));
  }

  get soft() { return false; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, push: Math.cos(ang) * (1.5 + 3 * k) }; }

  update(dt, t) {
    const H = world.H;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        this.om += this.react.push * cfg.spider.sway; this.react = null;
        this.st = "up"; this.goal = rand(16, 44);
      }
    }
    let moving = true;
    switch (this.st) {
      case "hang":
        moving = false; this.tm -= dt;
        if (this.tm <= 0) { this.goal = rand(70, H - 90); this.st = "move"; }
        break;
      case "move": case "down": {                             // lets itself down, or climbs, a bit at a time
        const d = this.goal - this.len, v = (this.st === "down" ? 45 : 70) * cfg.speed * (0.6 + 0.4 * Math.sin(t * 3 + this.ph));
        if (Math.abs(d) < 3) { this.st = "hang"; this.tm = rand(2, 8); break; }
        this.len += Math.sign(d) * Math.min(Math.abs(d), Math.max(8, v) * dt);
        break;
      }
      case "up":
        this.len += (this.goal - this.len) * Math.min(1, dt * 9);
        if (Math.abs(this.goal - this.len) < 4) { this.st = "wait"; this.tm = cfg.spider.wait * rand(0.7, 1.4); }
        break;
      case "wait":
        moving = false; this.tm -= dt;
        if (this.tm <= 0) { this.goal = rand(90, H - 90); this.st = "down"; }
        break;
    }
    if (moving) { this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = this.st === "up" ? 0.05 : 0.16; } }
    /* a pendulum: shorter threads swing faster */
    this.om += (-this.th * 900 / Math.max(40, this.len) + Math.sin(t * 0.7 + this.ph) * 0.12 * cfg.spider.sway) * dt;
    this.om *= Math.pow(0.45, dt);
    this.th = clamp(this.th + this.om * dt, -1.1, 1.1);
    this.x = this.ax + Math.sin(this.th) * this.len; this.y = Math.cos(this.th) * this.len;
  }

  shadow() {
    const ctx = world.ctx;                                     // the thread
    ctx.strokeStyle = "rgba(235,240,255,.34)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(this.ax, 0); ctx.lineTo(this.x, this.y - this.cs * 2); ctx.stroke();
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs;
    if (!cfg.shadows) this.shadow();
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(-this.th * 0.8);
    for (const c of this.poses[this.fr]) paintCell(c, c.ox * cs, c.oy * cs, cs, t);
    ctx.restore();
  }
}

/* a quarter of a web in a top corner; side is 1 for the left corner, -1 for the right */
function web(x, side, R) {
  const ctx = world.ctx, n = 6;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; ctx.moveTo(x, 0); ctx.lineTo(x + side * Math.cos(a) * R, Math.sin(a) * R); }
  for (let r = R * 0.25; r < R; r += R * 0.2) {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI / 2, a1 = (i + 1) / n * Math.PI / 2, am = (a0 + a1) / 2;
      ctx.moveTo(x + side * Math.cos(a0) * r, Math.sin(a0) * r);
      ctx.quadraticCurveTo(x + side * Math.cos(am) * r * 0.86, Math.sin(am) * r * 0.86, x + side * Math.cos(a1) * r, Math.sin(a1) * r);
    }
  }
  ctx.stroke();
}

export default {
  id: "spider", dot: "#b49cff", theme: "night", particles: "fireflies",
  density: 1 / 110000, margin: 70, glyphScale: SP, separate: false,

  init() {},
  make: (x, y) => new Spider(x, y),

  under() {
    if (!cfg.spider.webs) return;
    const ctx = world.ctx, R = Math.min(world.W, world.H) * 0.3;
    ctx.strokeStyle = "rgba(235,240,255,.16)"; ctx.lineWidth = 1;
    web(0, 1, R); web(world.W, -1, R * 0.8);
  }
};
