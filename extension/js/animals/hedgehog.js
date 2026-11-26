/*
 * Hedgehogs potter about, stop to sniff, and sometimes find an apple to carry.
 * Click: the ones the wave reaches curl into a ball and roll away, lie low for
 * a bit, then peek out and unroll.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, turn, makeCells, paintCell, pupil, spark, puff } from "../world.js";

/* side view, facing right. S spike, s spike tip, F face, E eye, N nose, L leg */
const WALK = [
  "..SsSsS..",
  ".sSSsSSs.",
  "SSsSSSFF.",
  "sSSSsSFEN",
  ".SsSSFFF."
];
const LEGS = { S: "..L...L..", A: ".L....L..", B: "...L...L." };
const BALL = [
  "..SsSS..",
  ".SSSsSS.",
  "SsSSSSsF",
  "SSSsSSSS",
  ".SsSSSS.",
  "..SSsS.."
];
const HS = 0.85;
const LOADS = ["hsl(355,78%,50%)", "hsl(355,78%,50%)", "hsl(95,60%,48%)", "hsl(32,90%,55%)"];   // apples, a pear, an autumn leaf

class Hedgehog {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "sniff"; this.tm = rand(0.3, 3);
    this.vx = 0; this.vy = 0; this.fr = 0; this.frT = 0; this.k = 0; this.rolled = 0;
    this.react = null; this.load = Math.random() < 0.35 ? pick(LOADS) : null;
    this.cs = cell() * HS; this.rad = this.cs * 3.6; this.ay = 0.6;
    const tint = rand(-4, 4), hue = rand(22, 34);
    const paint = ch => {
      const n = Math.random();
      if (ch === "S") return [`hsl(${hue},26%,${20 + n * 7 + tint}%)`, "rgba(255,225,190,.3)"];
      if (ch === "s") return [`hsl(${hue + 8},32%,${50 + n * 10 + tint}%)`, "rgba(60,40,20,.3)"];
      if (ch === "N") return ["#17100d", null];
      if (ch === "L") return [`hsl(${hue},32%,${48 + n * 6}%)`, null];
      return [`hsl(${hue + 6},45%,${70 + n * 6}%)`, null];           // F, E
    };
    const pose = rows => makeCells(rows, 4, rows.length - 0.5, paint);
    this.poses = { S: pose(WALK.concat(LEGS.S)), A: pose(WALK.concat(LEGS.A)), B: pose(WALK.concat(LEGS.B)) };
    this.ball = makeCells(BALL, 3.5, 2.5, paint);
  }

  get soft() { return this.st === "walk" || this.st === "sniff"; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  bounce(m) {
    const { W, H } = world;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); this.dir = 1; }
    else if (this.x > W - m) { this.x = W - m; this.vx = -Math.abs(this.vx); this.dir = -1; }
    if (this.y < m + 30) { this.y = m + 30; this.vy = Math.abs(this.vy); }
    else if (this.y > H - 30) { this.y = H - 30; this.vy = -Math.abs(this.vy); }
  }

  update(dt) {
    const cs = this.cs;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const r = this.react, v = (170 + 430 * r.k) * cfg.hedgehog.roll; this.react = null;
        if (this.load) {                                        // whatever it carried goes flying
          for (let i = 0; i < 4; i++) spark({ x: this.x, y: this.y - cs * 6, vx: rand(-90, 90), vy: rand(-220, -90), life: rand(0.5, 0.9), ch: pick(["o", "*", "."]), c: this.load });
          this.load = null;
        }
        this.st = "roll"; this.vx = Math.cos(r.ang) * v; this.vy = Math.sin(r.ang) * v * 0.7;
        this.dir = this.vx >= 0 ? 1 : -1; this.rolled = 0;
      }
    }
    this.tm -= dt;
    switch (this.st) {
      case "sniff":
        if (this.tm <= 0) {
          if (cfg.hedgehog.apples && !this.load && Math.random() < 0.18) {   // found something tasty
            this.load = pick(LOADS); puff(this.x, this.y - cs * 6, 5, 8, "#ffd25e");
          }
          const a = rand(0, Math.PI * 2), sp = rand(20, 38) * cfg.speed;
          this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.5;
          this.dir = this.vx >= 0 ? 1 : -1;
          this.st = "walk"; this.tm = rand(2, 6);
        }
        break;
      case "walk":
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.bounce(60);
        this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.2 / Math.max(0.3, cfg.speed); }
        if (this.tm <= 0) { this.st = "sniff"; this.tm = rand(0.8, 3); }
        break;
      case "roll": {
        const sp = Math.hypot(this.vx, this.vy);
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.bounce(50);
        const f = Math.pow(0.3, dt); this.vx *= f; this.vy *= f;
        this.rolled += sp * dt;
        this.k = ((Math.floor(this.rolled / (cs * 2.4)) * this.dir) % 4 + 4) % 4;
        if (Math.random() < dt * sp * 0.05) spark({ x: this.x - this.dir * cs * 3, y: this.y - cs, vx: -this.dir * rand(10, 50), vy: rand(-70, -20), life: rand(0.3, 0.6), ch: ".", c: "#b9a98a" });
        if (sp < 18) { this.st = "ball"; this.tm = cfg.hedgehog.curl * rand(0.7, 1.3); }
        break;
      }
      case "ball":
        if (this.tm <= 0) { this.st = "up"; this.tm = 0.55; }
        break;
      case "up":                                               // unrolls with a wobble
        if (this.tm <= 0) { this.st = "sniff"; this.tm = rand(0.6, 2); }
        break;
    }
  }

  get curled() { return this.st === "roll" || this.st === "ball" || (this.st === "up" && this.tm > 0.25); }

  shadow() {
    const ctx = world.ctx, cs = this.cs, w = this.curled ? cs * 7 : cs * 8.4;
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#000";
    ctx.fillRect(this.x - w / 2 + 3, this.y - cs * 0.35, w, cs * 1.1);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, flip = this.dir < 0 ? -1 : 1;
    if (this.curled) {
      const peek = this.st === "ball" && this.tm < 0.6 ? Math.sin(t * 30) * 0.8 : 0;     // about to come out
      const wob = this.st === "up" ? Math.sin(this.tm * 40) * cs * 0.2 : 0;
      for (const c of this.ball) {
        const [rx, ry] = turn(c.ox * flip, c.oy, this.k);
        paintCell(c, this.x + wob + peek + rx * cs, this.y - cs * 3 + ry * cs, cs, t);
      }
      return;
    }
    const cells = this.st === "walk" ? (this.fr ? this.poses.A : this.poses.B) : this.poses.S;
    const wob = this.st === "up" ? Math.sin(this.tm * 40) * cs * 0.2 : 0;
    const nod = this.st === "sniff" ? Math.sin(t * 9) * cs * 0.12 : 0;                    // nose twitching
    for (const c of cells) {
      const face = c.ch === "F" || c.ch === "E" || c.ch === "N";
      const px = this.x + wob + c.ox * flip * cs, py = this.y + c.oy * cs + (face ? nod : 0);
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px, py, cs * 0.24);
    }
    if (this.load && cfg.hedgehog.apples) {
      const s = cs * 1.5, px = this.x - flip * cs * 1.2, py = this.y - cs * 6.5;
      ctx.fillStyle = this.load; ctx.fillRect(px - s / 2, py - s / 2, s - 1, s - 1);
      ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(px - s / 2, py - s / 2, s * 0.4, s * 0.4);
      ctx.fillStyle = "hsl(110,45%,32%)"; ctx.fillRect(px - cs * 0.2, py - s / 2 - cs * 0.6, cs * 0.5, cs * 0.6);
    }
  }
}

export default {
  id: "hedgehog", dot: "#c79a6b", theme: "forest", particles: "leaves",
  density: 1 / 110000, margin: 90, glyphScale: HS,

  init() {},
  make: (x, y) => new Hedgehog(x, y)
};
