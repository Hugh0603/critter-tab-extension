/*
 * Dogs trot about, wag their tails and stop to scratch behind an ear.
 * Click: a ball is thrown from that spot. The nearest dog fetches it, carries it
 * back to where you clicked and sits there waiting for the next throw.
 * Right-click startles them.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, makeCells, paintCell, pupil, spark, TAU } from "../world.js";

/* side view, facing right. B fur, r ear, H head, E eye, n nose, T tail, l leg */
const BODY = [
  "..........rr....",
  "T.........HHHH..",
  ".T.BBBBBBHHEHHn.",
  "..BBBBBBBBHHHH..",
  "..BBBBBBBB......"
];
const LEGS = { A: ["..l.l....l.l...", "..l.l....l.l..."], B: ["...l.l..l.l....", "...l.l..l.l...."] };
const DS = 0.72;

let list = [], ball = null;

class Dog {
  constructor(x, y) {
    this.x = x; this.y = y; this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "idle"; this.tm = rand(0.5, 4); this.fr = 0; this.frT = 0;
    this.tx = x; this.ty = y; this.sp = 0; this.next = "idle"; this.react = null; this.carry = false;
    this.cs = cell() * DS * rand(0.85, 1.2); this.rad = this.cs * 5.5; this.ay = 0.6;
    const hue = pick([28, 34, 22, 40, 0, 210]), sat = hue === 0 || hue === 210 ? 4 : 42, l0 = pick([28, 38, 48, 58, 18]);
    this.pat = Math.random() < 0.35;                           // a patch on the back
    const paint = (ch, c, r) => {
      const n = Math.random();
      if (ch === "E") return ["#f6f6f2", null];
      if (ch === "n") return ["#16120f", null];
      if (ch === "r") return [`hsl(${hue},${sat}%,${Math.max(10, l0 - 14)}%)`, null];
      if (ch === "l") return [`hsl(${hue},${sat}%,${l0 - 4}%)`, null];
      if (this.pat && ch === "B" && c > 3 && c < 7 && r > 1) return [`hsl(${hue},${sat}%,${Math.min(88, l0 + 38)}%)`, "rgba(0,0,0,.18)"];
      return [`hsl(${hue},${sat}%,${l0 + n * 7}%)`, "rgba(255,255,255,.26)"];
    };
    const pose = k => makeCells(BODY.concat(LEGS[k]), 7, BODY.length + 1.5, paint);
    this.poses = { A: pose("A"), B: pose("B") };
  }

  get soft() { return this.st === "idle" || this.st === "scratch"; }

  hit(ang, d) { this.react = { delay: d / cfg.wave, ang }; }

  run(tx, ty, sp, next) {
    this.tx = clamp(tx, 40, world.W - 40); this.ty = clamp(ty, 90, world.H - 30);
    this.sp = sp * Math.max(0.5, cfg.speed); this.next = next; this.st = "run";
  }

  update(dt, t) {
    const { W, H } = world;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const a = this.react.ang; this.react = null;
        if (this.carry && ball) { ball.carried = null; ball.st = "ground"; ball.rest = false; ball.claimed = false; this.carry = false; }
        spark({ x: this.x, y: this.y - this.cs * 5, vx: 0, vy: -40, g: 0, life: 0.8, ch: "!", c: "#ffd25e" });
        this.run(this.x + Math.cos(a) * 320, this.y + Math.sin(a) * 200, 360, "idle");
      }
    }
    this.tm -= dt;
    switch (this.st) {
      case "idle":
        if (this.tm <= 0) {
          if (Math.random() < cfg.dog.scratch * 0.5) { this.st = "scratch"; this.tm = rand(1.2, 2.6); }
          else this.run(this.x + rand(-300, 300), this.y + rand(-170, 170), rand(70, 130), "idle");
        }
        break;
      case "scratch":
        if (Math.floor(t * 9) % 3 === 0 && Math.random() < dt * 14) spark({ x: this.x + this.dir * this.cs * 2, y: this.y - this.cs * 4, vx: rand(-30, 30), vy: -30, life: 0.5, ch: ".", c: "#c9b79a" });
        if (this.tm <= 0) { this.st = "idle"; this.tm = rand(1, 4); }
        break;
      case "wait":
        if (this.tm <= 0) { this.st = "idle"; this.tm = rand(0.5, 2); }
        break;
      case "run": {
        const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
        if (d > 7) {
          const v = Math.min(this.sp * dt, d);
          this.x += dx / d * v; this.y += dy / d * v;
          if (Math.abs(dx) > 2) this.dir = dx >= 0 ? 1 : -1;
          this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.07; }
          if (this.carry && ball) { ball.x = this.x + this.dir * this.cs * 8.3; ball.y = this.y + 2; ball.z = this.cs * 1.7; }
          break;
        }
        this.arrive();
        break;
      }
    }
  }

  arrive() {
    const n = this.next;
    if (n === "grab") {
      if (ball && ball.carried === null && ball.st === "ground") {
        this.carry = true; ball.carried = this;
        this.run(ball.home.x + rand(-50, 50) * (this.dir), ball.home.y + rand(-20, 20), 250, "drop");
        return;
      }
    } else if (n === "drop" && ball && ball.carried === this) {
      this.carry = false; ball.carried = null; ball.st = "ground"; ball.rest = true; ball.z = 0;
      ball.x += this.dir * this.cs * 2; ball.y = this.y + 2; ball.left = 14;
      this.st = "wait"; this.tm = rand(5, 9); this.fr = 0;
      spark({ x: this.x, y: this.y - this.cs * 5, vx: 0, vy: -50, g: 0, life: 0.9, ch: "♥", c: "#ff6f8e" });
      return;
    }
    this.carry = false; this.st = "idle"; this.tm = rand(0.5, 2);
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs;
    ctx.globalAlpha = 0.26; ctx.fillStyle = "#000";
    ctx.fillRect(this.x - cs * 6.5 + 2, this.y - cs * 0.3, cs * 13, cs);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const cs = this.cs, flip = this.dir < 0 ? -1 : 1;
    const sit = this.st === "wait" || this.st === "scratch";
    const cells = this.st === "run" && this.fr ? this.poses.B : this.poses.A;
    const wag = this.st === "wait" ? 22 : this.st === "run" ? 14 : 6, wagA = cs * 0.55 * cfg.dog.wag;
    const sink = sit ? cs * 0.7 : 0, bob = this.st === "run" ? Math.abs(Math.sin(t * 22)) * cs * 0.18 : 0;
    const shake = this.st === "scratch" ? Math.sin(t * 38) * cs * 0.18 : 0;
    for (const c of cells) {
      const head = "HEnr".includes(c.ch);
      let px = this.x + c.ox * flip * cs, py = this.y + c.oy * cs - bob;
      if (c.ch === "T") py += Math.sin(t * wag + c.ph * 0.2) * wagA - (this.st === "wait" ? cs * 0.5 : 0);
      if (sit && !head) py += sink * (c.ox < 0 ? 1.4 : 0.8);
      if (head) { py += shake; if (this.st === "scratch") px += shake; }
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px, py, cs * 0.28);
    }
    if (this.st === "scratch") {                              // the hind leg doing the scratching
      const ctx = world.ctx;
      ctx.fillStyle = "#d9c3a3";
      const k = Math.sin(t * 38);
      ctx.fillRect(this.x + flip * cs * 2 - cs * 0.5 + k * cs * 0.3, this.y - cs * 2.2 + k * cs * 0.2, cs, cs * 1.6);
    }
  }
}

function drawBall(t) {
  if (!ball) return;
  const ctx = world.ctx, s = cell() * 0.55, p = ball;
  if (p.carried) return drawBallAt(p.x, p.y - p.z, s);
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, s * 0.9, s * 0.35, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  drawBallAt(p.x, p.y - p.z - s * 0.7, s);
}
function drawBallAt(x, y, s) {
  const ctx = world.ctx;
  ctx.fillStyle = "#ff5d6c"; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, s * 0.62, 0.6, 2.5); ctx.stroke();
}

export default {
  id: "dog", dot: "#d9a066", theme: "hearth", particles: "leaves",
  density: 1 / 125000, margin: 110, glyphScale: DS,

  init(animals) { list = animals; ball = null; },
  make: (x, y) => new Dog(x, y),

  poke(x, y) {
    if (ball && ball.carried) { ball.carried.carry = false; ball.carried.st = "idle"; }
    const a = rand(0, TAU), L = cfg.dog.throw * rand(0.7, 1.15);
    ball = {
      x, y, z: 0, home: { x, y }, t: 0, st: "fly", rest: false, left: 0, claimed: false, carried: null,
      x0: x, y0: y, x1: clamp(x + Math.cos(a) * L, 50, world.W - 50), y1: clamp(y + Math.sin(a) * L * 0.55, 110, world.H - 40)
    };
    for (let i = 0; i < 6; i++) spark({ x, y, vx: rand(-90, 90), vy: rand(-140, -20), life: 0.5, ch: "*", c: "#ffd25e" });
    return true;
  },

  update(dt) {
    const b = ball;
    if (!b || b.carried) return;
    if (b.st === "fly") {
      b.t += dt;
      const u = Math.min(1, b.t / 0.85);
      b.x = b.x0 + (b.x1 - b.x0) * u; b.y = b.y0 + (b.y1 - b.y0) * u;
      b.z = 150 * 4 * u * (1 - u);
      if (u >= 1) { b.st = "ground"; b.z = 0; b.x0 = b.x; b.y0 = b.y; b.claimed = false; }
    } else if (b.st === "ground") {
      if (!b.rest && !b.claimed) {                           // somebody has to go and get it
        let best = null, bd = Infinity;
        for (const d of list) {
          if (d.carry || d.next === "grab" && d.st === "run" || d.react) continue;
          const dd = Math.hypot(d.x - b.x, d.y - b.y);
          if (dd < bd) { bd = dd; best = d; }
        }
        if (best) { b.claimed = true; best.run(b.x, b.y, 300, "grab"); }
      }
      if (b.rest) { b.left -= dt; if (b.left <= 0) ball = null; }
    }
  },

  under(t) { drawBall(t); }
};
