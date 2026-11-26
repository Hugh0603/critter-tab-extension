/*
 * Ghosts float about and, if you let them, drift shyly after your cursor.
 * Click: the ones the wave reaches vanish, then pop back somewhere else with a "boo".
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, makeCells, paintCell, spark } from "../world.js";

/* G sheet, E eye, m mouth (only open when it says boo) */
const BODY = [
  "..GGGGG..",
  ".GGGGGGG.",
  "GGEGGGEGG",
  "GGEGGGEGG",
  "GGGGGGGGG",
  "GGGGmGGGG",
  "GGGGGGGGG"
];
const HEMS = ["G.GG.GG.G", "GG.G.G.GG"];
const GS = 0.9;
const DARK = "#14152b";

class Ghost {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.st = "float"; this.tm = 0; this.alpha = 1; this.boo = 0;
    this.tx = x; this.ty = y; this.goT = rand(0, 4);
    this.ph = rand(0, 6); this.look = 0; this.react = null;
    this.keep = rand(7, 13);                                   // how close it dares to come to the cursor, in cells
    this.cs = cell() * GS * rand(0.8, 1.2); this.rad = this.cs * 4.6; this.ay = 1;
    const tint = pick([[225, 40], [225, 40], [190, 45], [280, 40], [150, 35]]);
    const paint = ch => {
      if (ch === "E") return [DARK, null];
      return [`hsl(${tint[0]},${tint[1]}%,${90 + Math.random() * 7}%)`, "rgba(90,100,170,.34)"];
    };
    this.body = makeCells(BODY, 4, 3.5, paint);
    this.hems = HEMS.map(row => makeCells([row], 4, -3.5, paint));
  }

  get soft() { return this.st === "float"; }

  hit(ang, d, k) { if (this.st === "float") this.react = { delay: d / cfg.wave }; }

  update(dt) {
    const { W, H, mouse } = world, cs = this.cs, m = 80;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        this.react = null; this.st = "out";
        spark({ x: this.x, y: this.y - cs * 5, vy: -50, life: 0.5, ch: "!", c: "#dfe4ff", g: 0 });
      }
    }
    if (this.boo > 0) this.boo -= dt;
    switch (this.st) {
      case "out":                                              // fades away
        this.alpha -= dt * 5;
        if (this.alpha <= 0) { this.alpha = 0; this.st = "gone"; this.tm = rand(0.8, 2.2) * cfg.ghost.hide; }
        return;
      case "gone":
        this.tm -= dt;
        if (this.tm <= 0) {
          this.x = this.tx = rand(m, W - m); this.y = this.ty = rand(m, H - m); this.vx = this.vy = 0;
          this.st = "in"; this.boo = 0.9;
          for (let i = 0; i < 7; i++) spark({ x: this.x + rand(-cs * 4, cs * 4), y: this.y + rand(-cs * 4, cs * 4), vx: rand(-40, 40), vy: rand(-60, 10), life: rand(0.4, 0.9), ch: pick(["·", "*", "+"]), c: "#dfe4ff", g: 0 });
        }
        return;
      case "in":
        this.alpha = Math.min(1, this.alpha + dt * 2.4);
        if (this.alpha >= 1) this.st = "float";
        break;
    }
    /* where to: after the cursor (but not too close), or just wandering */
    let sp = 24;
    if (cfg.ghost.follow && mouse.on) {
      const dx = this.x - mouse.x, dy = this.y - mouse.y, d = Math.hypot(dx, dy) || 1, keep = cs * this.keep;
      this.tx = mouse.x + dx / d * keep; this.ty = mouse.y + dy / d * keep;
      sp = 46;
    } else {
      this.goT -= dt;
      if (this.goT <= 0) { this.tx = rand(m, W - m); this.ty = rand(m, H - m); this.goT = rand(4, 9); }
    }
    const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
    const v = Math.min(sp * cfg.speed, d * 1.5), k = Math.min(1, dt * 1.6);
    this.vx += ((d > 1 ? dx / d * v : 0) - this.vx) * k;
    this.vy += ((d > 1 ? dy / d * v : 0) - this.vy) * k;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const want = cfg.ghost.follow && mouse.on ? Math.sign(mouse.x - this.x) : Math.abs(this.vx) > 4 ? Math.sign(this.vx) : 0;
    this.look += (want - this.look) * Math.min(1, dt * 5);
  }

  draw(t) {
    if (this.alpha <= 0.01) return;
    const ctx = world.ctx, cs = this.cs;
    const y = this.y + Math.sin(t * 1.6 + this.ph) * cs * 0.6;          // bobbing
    ctx.globalAlpha = this.alpha * cfg.ghost.opacity;
    const hem = this.hems[Math.floor(t * 2.6 + this.ph) & 1];
    for (const list of [this.body, hem]) {
      for (const c of list) {
        const sway = Math.sin(t * 2.8 + c.oy * 0.7 + this.ph) * cs * 0.16 * (c.oy + 3.5) / 7;   // the sheet ripples more towards the hem
        const px = this.x + sway + c.ox * cs, py = y + c.oy * cs;
        if (c.ch === "m") {
          if (this.boo > 0) { ctx.fillStyle = DARK; ctx.fillRect(px - cs * 0.75, py - cs * 0.6, cs * 1.5, cs * 1.3); }
          else paintCell(c, px, py, cs, t);
        } else if (c.ch === "E") {
          ctx.fillStyle = c.fill; ctx.fillRect(px - cs / 2 + this.look * cs * 0.3, py - cs / 2, cs - 1, cs);
        } else paintCell(c, px, py, cs, t);
      }
    }
    ctx.globalAlpha = 1;
  }
}

export default {
  id: "ghost", dot: "#dfe4ff", theme: "night", particles: "stars",
  density: 1 / 130000, margin: 90, glyphScale: GS,

  init() {},
  make: (x, y) => new Ghost(x, y)
};
