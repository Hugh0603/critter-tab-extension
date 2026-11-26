/*
 * Bats sleep upside down along the top edge, wings folded. Now and then one twitches an ear.
 * Click: the ones the wave reaches tear loose all together, wheel round the screen
 * in one big flock, then each one comes back to its own spot and hangs up again.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, makeCells, paintCell, pupil } from "../world.js";

/* asleep, hanging from the top row: f claws, B body, w wing, r ear, E eyes */
const SLEEP = [
  "..f..f..",
  "..BBBB..",
  ".wBBBBw.",
  ".wBEEBw.",
  "..rBBr.."
];
/* flying, seen from above: wings up and wings down */
const UP = ["W.......W", "WW.rBr.WW", ".WWBEBWW.", "..WBBBW.."];
const DOWN = ["..rBr..", ".WWBEBWW.", "WW.BBB.WW", "W.......W"];
const BS = 0.7;

let list = [];
const flock = { x: 0, y: 0, rx: 0, ry: 0, w: 1, a: 0 };

class Bat {
  constructor(x) {
    this.hx = x; this.hy = rand(70, 78);
    this.x = x; this.y = this.hy; this.vx = 0;
    this.st = "sleep"; this.tm = rand(2, 12); this.react = null;
    this.a = rand(0, TAU); this.rr = rand(0.55, 1.15); this.ph = rand(0, 6); this.fl = 0; this.stay = 0; this.twitch = 0;
    this.cs = cell() * BS * rand(0.85, 1.2); this.rad = this.cs * 4; this.ay = 1;
    const h = pick([265, 280, 250, 300, 20]), eye = pick(["#ff5d6c", "#ffd25e", "#8affc1"]);
    const paint = ch => {
      const n = Math.random();
      if (ch === "E") return [eye, null];
      if (ch === "f") return ["hsl(30,12%,50%)", null];
      if (ch === "r") return [`hsl(${h},20%,24%)`, null];
      if (ch === "w" || ch === "W") return [`hsl(${h},30%,${24 + n * 8}%)`, "rgba(200,170,255,.3)"];
      return [`hsl(${h},18%,${22 + n * 8}%)`, "rgba(220,200,255,.3)"];
    };
    this.sleep = makeCells(SLEEP, 4, 0, paint);
    this.up = makeCells(UP, 4, 1.5, paint);
    this.down = makeCells(DOWN, 3, 1.5, paint);
  }

  get soft() { return false; }

  hit(ang, d) { this.react = { delay: d / cfg.wave }; }

  wake(len) { this.st = "fly"; this.stay = len; this.a = Math.atan2(this.y - flock.y, (this.x - flock.x) / Math.max(1, flock.rx / flock.ry)); }

  update(dt, t) {
    const { W, H } = world;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        this.react = null;
        if (this.st === "sleep" || this.st === "home") {
          if (!flockActive()) startFlock();
          this.wake(rand(0.8, 1.2) * cfg.bat.fly);
        } else this.stay = Math.max(this.stay, cfg.bat.fly * 0.5);
      }
    }
    this.fl += dt * 13 * cfg.bat.flap;
    switch (this.st) {
      case "sleep":
        this.tm -= dt;
        if (this.twitch > 0) this.twitch -= dt;
        if (this.tm <= 0) {
          if (Math.random() < cfg.bat.insomnia * 0.12 && !flockActive()) { startFlock(true); this.wake(rand(3, 6)); }
          else this.twitch = 0.35;
          this.tm = rand(4, 16);
        }
        break;
      case "fly": {
        this.stay -= dt;
        this.a += flock.w * this.rr * dt * cfg.speed;
        const bob = Math.sin(t * 3 + this.ph) * 14;
        const tx = flock.x + Math.cos(this.a) * flock.rx * this.rr, ty = flock.y + Math.sin(this.a * 1.3 + this.ph) * flock.ry * (0.5 + 0.5 * this.rr) + bob;
        const k = Math.min(1, dt * 3.2);
        this.vx = (tx - this.x) * k;
        this.x += this.vx; this.y += (ty - this.y) * k;
        if (this.stay <= 0) this.st = "home";
        break;
      }
      case "home": {
        const dx = this.hx - this.x, dy = this.hy - this.y, d = Math.hypot(dx, dy);
        const v = Math.min(d, 330 * cfg.speed * dt);
        if (d < 5) { this.st = "sleep"; this.x = this.hx; this.y = this.hy; this.tm = rand(4, 12); this.vx = 0; break; }
        this.x += dx / d * v; this.y += dy / d * v + Math.sin(t * 9 + this.ph) * 1.5; this.vx = dx / d * v;
        break;
      }
    }
    this.x = clamp(this.x, 10, W - 10); this.y = clamp(this.y, 8, H - 10);
  }

  draw(t) {
    const cs = this.cs;
    if (this.st === "sleep") {
      const ctx = world.ctx;
      ctx.strokeStyle = "rgba(235,240,255,.1)"; ctx.lineWidth = 1;
      for (const c of this.sleep) {
        const ear = c.ch === "r" && this.twitch > 0 ? Math.sin(this.twitch * 60) * cs * 0.4 : 0;
        paintCell(c, this.x + c.ox * cs + ear, this.y + c.oy * cs, cs, t);
        if (c.ch === "E") {                                  // eyes shut: a thin dark line
          ctx.fillStyle = "#0a0a0a"; ctx.fillRect(this.x + c.ox * cs - cs * 0.35, this.y + c.oy * cs, cs * 0.7, 2);
        }
      }
      return;
    }
    const cells = Math.sin(this.fl) > 0 ? this.up : this.down;
    const ctx = world.ctx;
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(clamp(this.vx * 0.012, -0.5, 0.5));
    const flap = Math.abs(Math.sin(this.fl)) * 0.35 + 0.8;
    for (const c of cells) {
      const px = c.ox * cs * (c.ch === "W" ? flap : 1), py = c.oy * cs;
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px, py, cs * 0.22);
    }
    ctx.restore();
  }
}

const flockActive = () => list.some(b => b.st === "fly");

function startFlock(small) {
  const { W, H } = world;
  flock.x = W / 2 + rand(-W * 0.12, W * 0.12); flock.y = H * 0.48;
  flock.rx = (small ? 0.22 : 0.4) * W; flock.ry = (small ? 0.2 : 0.3) * H;
  flock.w = (Math.random() < 0.5 ? 1 : -1) * rand(0.9, 1.3);
}

export default {
  id: "bat", dot: "#9a7bd6", theme: "abyss", particles: "stars",
  density: 1 / 140000, margin: 20, glyphScale: BS, separate: false,

  init(animals) { list = animals; },
  make: (x) => new Bat(x),

  /* the beam they hang from, just under the switcher */
  under() {
    const ctx = world.ctx;
    ctx.fillStyle = "rgba(70,52,96,.55)"; ctx.fillRect(0, 62, world.W, 7);
    ctx.fillStyle = "rgba(160,130,210,.18)"; ctx.fillRect(0, 62, world.W, 2);
  }
};
