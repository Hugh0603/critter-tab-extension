/*
 * Cats sit about, wander, and nap. Click: a ball of yarn drops there and the
 * cats that notice run over, pounce and bat it around. Click a cat to pet it.
 * Right-click startles them.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, TAU, makeCells, paintCell, spark, puff, lureReach } from "../world.js";

/* side view, facing right. C coat, A ear, E eye, N nose, T tail, L leg, - closed eye */
const WALK = [
  ".......A.A.",
  "T......CCC.",
  "T......CECN",
  ".TCCCCCCCC.",
  "..CCCCCCC..",
  "..CCCCCCC.."
];
const LEGS = { S: "..L.L..L.L.", A: ".L..L.L...L", B: "..LL...LL.." };
const SIT = [
  "......A.A..",
  "......CCC..",
  "......CECN.",
  ".....CCCC..",
  "....CCCCC..",
  "T...CCCCC..",
  "TTTCCLCCL.."
];
const SLEEP = [
  "...CCCCA.A.",
  "..CCCCCCCC.",
  "TCCCCCCC-CN",
  "TTTCCCCCCC."
];
const CS = 0.8;

const COATS = [
  { body: [28, 80, 54], stripes: [22, 78, 42], eye: "#a6dc6c" },                 // ginger tabby
  { body: [28, 80, 54], stripes: [22, 78, 42], eye: "#a6dc6c", socks: true },
  { body: [235, 12, 24], eye: "#f2c84b" },                                        // black
  { body: [235, 12, 24], eye: "#a6dc6c", socks: true },                           // tuxedo
  { body: [215, 10, 46], stripes: [215, 12, 34], eye: "#a6dc6c" },               // grey tabby
  { body: [40, 15, 90], eye: "#6fb6ff" },                                        // white
  { body: [40, 15, 90], eye: "#f2c84b", calico: true },
  { body: [36, 30, 80], points: [25, 25, 30], eye: "#6fb6ff" }                   // siamese
];
const YARN = ["#ff5d6c", "#ffd25e", "#7ee0a1", "#6fb6ff", "#c58bff"];

let list = [];
const balls = [];

class Cat {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "sit"; this.tm = rand(0.5, 4);
    this.cs = cell() * CS; this.rad = this.cs * 4.2; this.ay = 0.6;
    this.vx = 0; this.vy = 0; this.fr = 0; this.frT = 0; this.lift = 0;
    this.ball = null; this.play = 0; this.react = null;
    this.blink = 0; this.blinkT = rand(1, 5); this.zT = 0; this.heartT = 0;
    const coat = pick(COATS), seed = rand(0, 9);
    const paint = (ch, c, r) => {
      const n = Math.random();
      if (ch === "N") return ["hsl(350,70%,72%)", null];
      if (ch === "E") return [coat.eye, null];
      let hsl = coat.body;
      if (coat.stripes && (ch === "C" || ch === "T") && (c + (r >> 1)) % 3 === 0) hsl = coat.stripes;
      if (coat.points && (ch === "A" || ch === "T" || ch === "L")) hsl = coat.points;
      if (coat.calico) { const v = Math.sin(c * 1.3 + seed) + Math.cos(r * 1.7 + seed * 2); hsl = v > 0.6 ? [28, 80, 52] : v < -0.6 ? [235, 12, 24] : [40, 15, 90]; }
      if (coat.socks && ch === "L") hsl = [40, 15, 92];
      return [`hsl(${hsl[0]},${hsl[1]}%,${hsl[2] + n * 6 - 3}%)`, hsl[2] > 60 ? "rgba(70,45,30,.28)" : "rgba(255,235,210,.3)"];
    };
    /* every pose stands on the ground line: the bottom edge of the last row is the cat's y */
    const pose = rows => makeCells(rows, 5, rows.length - 0.5, paint);
    this.poses = {
      sit: pose(SIT), sleep: pose(SLEEP),
      S: pose(WALK.concat(LEGS.S)), A: pose(WALK.concat(LEGS.A)), B: pose(WALK.concat(LEGS.B))
    };
  }

  get soft() { return this.st !== "run" && this.st !== "pounce"; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  notice(ball, d) { this.react = { delay: 0.12 + d / cfg.wave + rand(0, 0.3), ball }; }

  chase(ball) {
    this.ball = ball; this.st = "chase"; this.frT = 0;
    this.play = rand(4, 9) * cfg.cat.playful;
  }

  sitDown(tm) { this.st = "sit"; this.tm = tm; this.ball = null; this.lift = 0; }

  decide() {
    const r = Math.random(), lazy = cfg.cat.lazy;
    const ball = balls.find(b => !b.dying && Math.hypot(b.x - this.x, b.y - this.y) < lureReach());
    if (ball && Math.random() < 0.45 * cfg.cat.playful) { this.chase(ball); return; }
    if (r < lazy * 0.5) { this.st = "sleep"; this.tm = rand(6, 16); this.zT = 0.5; }
    else if (r < lazy * 0.5 + 0.45) {
      const a = rand(0, TAU), sp = rand(40, 70) * cfg.speed;
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.55;
      this.dir = this.vx >= 0 ? 1 : -1;
      this.st = "walk"; this.tm = rand(1.5, 4.5);
    } else this.sitDown(rand(1.5, 4));
  }

  bounce(m) {
    const { W, H } = world;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); this.dir = 1; }
    else if (this.x > W - m) { this.x = W - m; this.vx = -Math.abs(this.vx); this.dir = -1; }
    if (this.y < m + 40) { this.y = m + 40; this.vy = Math.abs(this.vy); }
    else if (this.y > H - 30) { this.y = H - 30; this.vy = -Math.abs(this.vy); }
  }

  step(dt, gap) { this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = gap; } }

  update(dt) {
    const cs = this.cs;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const r = this.react; this.react = null;
        if (r.ball) {
          if (!r.ball.dying && this.st !== "happy") {
            if (this.st === "sleep") spark({ x: this.x + this.dir * cs * 3, y: this.y - cs * 5, vy: -40, life: 0.6, ch: "!", c: "#ffd25e", g: 0 });
            this.chase(r.ball);
          }
        } else {                                               // startled: bolt away
          spark({ x: this.x, y: this.y - cs * 8, vy: -50, life: 0.5, ch: "!", c: "#ff5d6c", g: 0 });
          const sp = (230 + 160 * r.k) * Math.max(0.5, cfg.speed);
          this.vx = Math.cos(r.ang) * sp; this.vy = Math.sin(r.ang) * sp * 0.6;
          this.dir = this.vx >= 0 ? 1 : -1;
          this.st = "run"; this.tm = 0.5 + r.k * 0.7; this.ball = null;
        }
      }
    }
    this.tm -= dt; this.lift = 0;
    if (this.blink > 0) this.blink -= dt;
    switch (this.st) {
      case "sit":
        this.blinkT -= dt;
        if (this.blinkT <= 0) { this.blink = 0.14; this.blinkT = rand(2, 6); }
        if (this.tm <= 0) this.decide();
        break;
      case "walk":
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.bounce(70); this.step(dt, 0.17 / Math.max(0.3, cfg.speed));
        if (this.tm <= 0) this.sitDown(rand(1, 4));
        break;
      case "run":
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.bounce(70); this.step(dt, 0.07);
        if (this.tm <= 0) this.sitDown(rand(1, 3));
        break;
      case "sleep":
        this.zT -= dt;
        if (this.zT <= 0) {
          this.zT = rand(0.9, 1.6);
          spark({ x: this.x + this.dir * cs * 3.5, y: this.y - cs * 4.5, vx: this.dir * rand(6, 16), vy: rand(-32, -20), life: 1.5, ch: Math.random() < 0.5 ? "z" : "Z", c: "#cfd8ff", g: 0 });
        }
        if (this.tm <= 0) this.sitDown(rand(1, 3));
        break;
      case "happy":                                            // being petted
        this.heartT -= dt;
        if (this.heartT <= 0) {
          this.heartT = 0.22;
          spark({ x: this.x + rand(-cs * 3, cs * 3), y: this.y - cs * rand(5, 8), vx: rand(-12, 12), vy: rand(-55, -30), life: 0.9, ch: "♥", c: "#ff7d9c", g: 0 });
        }
        if (this.tm <= 0) this.sitDown(rand(1.5, 3));
        break;
      case "chase": {
        const b = this.ball;
        this.play -= dt;
        if (!b || b.dying || !balls.includes(b) || this.play <= 0) { this.sitDown(rand(1, 3)); break; }
        const dx = b.x - this.x, dy = b.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.dir = dx >= 0 ? 1 : -1;
        if (d < cs * 3.4 && b.z < cs * 4) { this.st = "pounce"; this.tm = 0.28; break; }
        const sp = Math.min(215 * Math.max(0.5, cfg.speed), d * 4 + 60);
        this.x += dx / d * sp * dt; this.y += dy / d * sp * dt;
        this.step(dt, 0.075);
        break;
      }
      case "pounce": {
        const p = 1 - Math.max(0, this.tm) / 0.28;
        this.lift = Math.sin(Math.PI * p) * cs * 2.4;
        this.x += this.dir * 70 * dt;
        if (this.tm <= 0) {
          const b = this.ball;
          if (b && !b.dying && Math.hypot(b.x - this.x, b.y - this.y) < cs * 6) {
            const a = (this.dir > 0 ? 0 : Math.PI) + rand(-1.1, 1.1), v = rand(260, 440);
            b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v * 0.6; b.vz = rand(160, 300); b.idle = 0;
            puff(b.x, b.y - b.z, 4, 6, b.color);
          }
          this.st = "chase"; this.frT = 0;
        }
        break;
      }
    }
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs;
    const w = this.st === "sleep" ? cs * 10.5 : this.st === "sit" || this.st === "happy" ? cs * 8 : cs * 9.5;
    ctx.globalAlpha = 0.28 * (1 - Math.min(0.6, this.lift / 80)); ctx.fillStyle = "#000";
    ctx.fillRect(this.x - w / 2 + 3, this.y - cs * 0.35, w, cs * 1.1);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, flip = this.dir < 0 ? -1 : 1;
    let cells;
    switch (this.st) {
      case "sleep": cells = this.poses.sleep; break;
      case "sit": case "happy": cells = this.poses.sit; break;
      case "pounce": cells = this.poses.A; break;
      default: cells = this.fr ? this.poses.A : this.poses.B;
    }
    const shut = this.blink > 0 || this.st === "happy";
    const purr = this.st === "happy" ? Math.sin(t * 46) * 0.7 : 0;
    for (const c of cells) {
      const px = this.x + purr + c.ox * flip * cs, py = this.y - this.lift + c.oy * cs;
      if (c.ch === "E" && !shut) {
        ctx.fillStyle = c.fill; ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(px - cs * 0.12, py - cs * 0.36, cs * 0.24, cs * 0.66);
      } else if (c.ch === "E" || c.ch === "-") {
        ctx.fillStyle = this.poses.sit[4].fill; ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(px - cs * 0.34, py - cs * 0.06, cs * 0.62, Math.max(1, cs * 0.14));
      } else paintCell(c, px, py, cs, t);
    }
  }
}

function toss(x, y) {
  const live = balls.filter(b => !b.dying);
  if (live.length >= 3) live[0].dying = true;
  const cs = cell() * CS;
  const b = { x, y, z: cs * 11, vx: rand(-50, 50), vy: rand(-25, 25), vz: 0, idle: 0, fade: 1, dying: false, color: pick(YARN), r: cs * 1.25, path: [{ x, y }], roll: 0 };
  balls.push(b);
  for (const a of list) {
    const d = Math.hypot(a.x - x, a.y - y);
    if (d > lureReach() || a.st === "happy" || (a.st === "sleep" && d > 320)) continue;
    a.notice(b, d);
  }
}

export default {
  id: "cat", dot: "#f2a65a", theme: "hearth", particles: "fireflies",
  density: 1 / 150000, margin: 100, glyphScale: CS,

  init(animals) { list = animals; balls.length = 0; },
  make: (x, y) => new Cat(x, y),

  poke(x, y) {
    if (cfg.cat.pet) {
      for (const a of list) {
        if (Math.abs(a.x - x) < a.cs * 5 && y < a.y + a.cs && y > a.y - a.cs * 8 && a.st !== "run" && a.st !== "pounce") {
          a.st = "happy"; a.tm = 1.7; a.heartT = 0; a.ball = null; a.react = null; a.lift = 0;
          return true;
        }
      }
    }
    toss(x, y);
    return true;
  },

  update(dt) {
    const { W, H } = world;
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= 900 * dt;
      b.roll += Math.hypot(b.vx, b.vy) * dt / b.r * Math.sign(b.vx || 1);
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -70) { b.vz = -b.vz * 0.45; b.vx *= 0.8; b.vy *= 0.8; } else b.vz = 0;
        const f = Math.pow(0.22, dt); b.vx *= f; b.vy *= f;
      }
      if (b.x < 40) { b.x = 40; b.vx = Math.abs(b.vx); } else if (b.x > W - 40) { b.x = W - 40; b.vx = -Math.abs(b.vx); }
      if (b.y < 90) { b.y = 90; b.vy = Math.abs(b.vy); } else if (b.y > H - 30) { b.y = H - 30; b.vy = -Math.abs(b.vy); }
      const last = b.path[b.path.length - 1];
      if (Math.hypot(b.x - last.x, b.y - last.y) > 7) { b.path.push({ x: b.x, y: b.y }); if (b.path.length > 90) b.path.shift(); }
      b.idle += dt;
      if (b.idle > cfg.cat.yarnLife) b.dying = true;
      if (b.dying) { b.fade -= dt * 1.4; if (b.fade <= 0) balls.splice(i, 1); }
    }
  },

  under() {
    const ctx = world.ctx;
    for (const b of balls) {
      if (b.path.length > 1) {                                  // the thread it leaves behind
        ctx.globalAlpha = 0.5 * b.fade; ctx.strokeStyle = b.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(b.path[0].x, b.path[0].y);
        for (let i = 1; i < b.path.length; i++) ctx.lineTo(b.path[i].x, b.path[i].y);
        ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.globalAlpha = 0.25 * b.fade * (1 - Math.min(0.6, b.z / 140)); ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(b.x + 2, b.y + 2, b.r * 1.1, b.r * 0.45, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  over() {
    const ctx = world.ctx;
    for (const b of balls) {
      const cy = b.y - b.z - b.r * 0.8;
      ctx.globalAlpha = b.fade;
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, cy, b.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(b.x, cy, b.r * 0.92, b.r * (0.25 + i * 0.25), b.roll + i * 1.1, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, cy - b.r * 0.35, b.r * 0.25, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
};
