/*
 * Flying saucers hang over the screen while little aliens wander about below, waving.
 * Click: the saucer nearest to the alien closest to your click slides over, lifts it
 * up in a beam, carries it across the sky and sets it down somewhere else.
 * Right-click startles the aliens.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, makeCells, paintCell, pupil, spark } from "../world.js";

/* front view. a antenna tip, G head and body, E eye, A arm, l leg */
const ALIEN = ["a.....a", ".GGGGG.", "GGEGEGG", ".GGGGG.", "..GGG..", ".A.G.A."];
const LEGS = { A: "..l.l..", B: "..l..l." };
/* D dome, H hull, L light */
const SAUCER = ["....DDDD....", "...DDDDDD...", ".HHHHHHHHHH.", "HLHLHLHLHLHL", "..HHHHHHHH.."];
const AS = 0.7, SS = 1.15;

let list = [], saucers = [];

class Alien {
  constructor(x, y) {
    this.x = x; this.y = y; this.z = 0; this.dir = 1; this.st = "idle"; this.tm = rand(0.5, 4);
    this.tx = x; this.ty = y; this.fr = 0; this.frT = 0; this.react = null; this.wave = 0; this.vz = 0; this.ph = rand(0, 6);
    this.cs = cell() * AS * rand(0.85, 1.2); this.rad = this.cs * 3.6; this.ay = 0.8;
    const h = pick([110, 130, 280, 175, 320]), glow = pick(["#ff7fd1", "#ffe45e", "#7fe9ff"]);
    const paint = ch => {
      const n = Math.random();
      if (ch === "E") return ["#080808", null];
      if (ch === "a") return [glow, null];
      if (ch === "l") return [`hsl(${h},48%,34%)`, null];
      if (ch === "A") return [`hsl(${h},50%,40%)`, null];
      return [`hsl(${h},55%,${44 + n * 9}%)`, "rgba(255,255,255,.26)"];
    };
    const pose = k => makeCells(ALIEN.concat(LEGS[k]), 3, ALIEN.length + 0.5, paint);
    this.poses = { A: pose("A"), B: pose("B") };
  }

  get soft() { return this.st === "idle" || this.st === "walk"; }

  hit(ang, d) { this.react = { delay: d / cfg.wave, ang }; }

  update(dt, t) {
    const { W, H } = world;
    if (this.st === "beam") return;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const a = this.react.ang; this.react = null;
        if (this.z <= 0) this.vz = 260;
        this.tx = clamp(this.x + Math.cos(a) * 260, 40, W - 40); this.ty = clamp(this.y + Math.sin(a) * 150, 200, H - 30); this.st = "scared"; this.tm = 1.2;
        spark({ x: this.x, y: this.y - this.cs * 9, vx: 0, vy: -40, g: 0, life: 0.8, ch: "!", c: "#ffd25e" });
      }
    }
    if (this.vz !== 0 || this.z > 0) { this.vz -= 900 * dt; this.z += this.vz * dt; if (this.z <= 0) { this.z = 0; this.vz = 0; } }
    this.tm -= dt; this.wave = Math.max(0, this.wave - dt);
    if (this.st === "idle") {
      if (this.tm <= 0) {
        if (Math.random() < 0.35) { this.wave = 1.6; this.tm = 1.8; }
        else { this.tx = clamp(this.x + rand(-220, 220), 40, W - 40); this.ty = clamp(this.y + rand(-120, 120), 200, H - 30); this.st = "walk"; }
      }
    } else {
      const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy), sp = (this.st === "scared" ? 280 : 55) * Math.max(0.5, cfg.speed);
      if (d > 5 && (this.st === "walk" || this.tm > 0)) {
        const v = Math.min(d, sp * dt); this.x += dx / d * v; this.y += dy / d * v;
        if (Math.abs(dx) > 2) this.dir = dx > 0 ? 1 : -1;
        this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = this.st === "scared" ? 0.07 : 0.22; }
      } else { this.st = "idle"; this.tm = rand(1, 4); }
    }
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs, s = 1 - Math.min(0.5, this.z / 400);
    ctx.globalAlpha = 0.26 * s; ctx.fillStyle = "#000";
    ctx.fillRect(this.x - cs * 2.6 * s, this.y - cs * 0.3, cs * 5.2 * s, cs * 0.9);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const cs = this.cs, cells = this.st === "walk" && this.fr || this.st === "scared" && this.fr ? this.poses.B : this.poses.A;
    const lifted = this.st === "beam", wig = lifted ? Math.sin(t * 9 + this.ph) * cs * 0.25 : 0;
    for (const c of cells) {
      let px = this.x + c.ox * cs + wig, py = this.y - this.z + c.oy * cs;
      if (c.ch === "A" && c.ox > 0) {                         // the right arm waves
        if (this.wave > 0 || lifted) py -= (cs * 1.8) * (0.55 + 0.45 * Math.sin(t * 12));
      }
      if (c.ch === "a") py += Math.sin(t * 5 + c.ox + this.ph) * cs * 0.18;
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px, py, cs * 0.12);
    }
  }
}

class Saucer {
  constructor(i, n) {
    const { W } = world;
    this.x = W * (i + 0.5) / n + rand(-40, 40); this.y = rand(105, 150); this.hx = this.x; this.hy = this.y;
    this.ph = rand(0, 6); this.alien = null; this.job = null; this.beam = 0; this.tx = this.x; this.drift = rand(-1, 1); this.wait = rand(2, 8);
    this.cs = cell() * SS;
  }
}

function dropPoint(s) {
  const { W, H } = world;
  let best = null, bd = -1;
  for (let i = 0; i < 8; i++) {
    const x = rand(80, W - 80), y = rand(200, H - 50);
    let m = Math.hypot(x - s.alien.x, y - s.alien.y);
    for (const a of list) if (a !== s.alien) m = Math.min(m, Math.hypot(a.x - x, a.y - y));
    if (m > bd) { bd = m; best = [x, y]; }
  }
  return best;
}

export default {
  id: "ufo", dot: "#7dffb0", theme: "abyss", particles: "stars",
  density: 1 / 170000, margin: 80, glyphScale: AS,

  init(animals) {
    list = animals; saucers = [];
    for (let i = 0; i < cfg.ufo.saucers; i++) saucers.push(new Saucer(i, cfg.ufo.saucers));
  },
  make: (x, y) => new Alien(x, y),

  poke(x, y) {
    let near = null, bd = Infinity;
    for (const a of list) { if (a.st === "beam") continue; const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; near = a; } }
    if (!near) return true;
    let sau = null, sd = Infinity;
    for (const s of saucers) { if (s.job) continue; const d = Math.abs(s.x - near.x); if (d < sd) { sd = d; sau = s; } }
    for (let i = 0; i < 5; i++) spark({ x, y, vx: rand(-70, 70), vy: rand(-90, -20), life: 0.5, ch: "+", c: "#9dffc8" });
    if (!sau) return true;
    sau.alien = near; sau.job = "go"; near.st = "beam"; near.wave = 0;
    return true;
  },

  update(dt, t) {
    const { W } = world, lift = 150 * cfg.ufo.lift;
    for (const s of saucers) {
      const hover = s.hy + Math.sin(t * 1.3 + s.ph) * 5;
      if (!s.job) {                                            // idle: drift a little
        s.wait -= dt;
        if (s.wait <= 0) { s.tx = clamp(s.hx + rand(-90, 90), 70, W - 70); s.wait = rand(3, 9); }
        s.x += (s.tx - s.x) * Math.min(1, dt * 0.8); s.beam = Math.max(0, s.beam - dt * 2.5);
        s.y += (hover - s.y) * Math.min(1, dt * 3);
        continue;
      }
      const a = s.alien;
      s.y += (hover - s.y) * Math.min(1, dt * 3);
      const under = s.y + s.cs * 2.6;                          // where the alien rides when it is all the way up
      switch (s.job) {
        case "go":
          s.x += (a.x - s.x) * Math.min(1, dt * 3.2);
          if (Math.abs(a.x - s.x) < 8) s.job = "beamUp";
          break;
        case "beamUp":
          s.beam = Math.min(1, s.beam + dt * 3);
          if (s.beam >= 1) {
            a.z += lift * dt;
            a.x += (s.x - a.x) * Math.min(1, dt * 6);
            if (a.y - a.z <= under) { a.z = Math.max(0, a.y - under); s.job = "carry"; const p = dropPoint(s); s.dest = p; s.tx = p[0]; }
          }
          if (Math.random() < dt * 22) spark({ x: a.x + rand(-14, 14), y: a.y - a.z + 10, vx: 0, vy: -70, g: 0, life: 0.5, ch: pick([".", "*", "'"]), c: "#b8ffd4" });
          break;
        case "carry": {
          const dx = s.tx - s.x;
          s.x += clamp(dx, -1, 1) * Math.min(Math.abs(dx), 260 * cfg.speed * dt);
          a.x = s.x;
          a.y = s.dest[1]; a.z = Math.max(0, a.y - under);               // it stays up in the sky, only its ground point moves
          if (Math.abs(dx) < 4) s.job = "down";
          break;
        }
        case "down":
          a.z = Math.max(0, a.z - lift * dt * 0.9);
          if (Math.random() < dt * 22) spark({ x: a.x + rand(-14, 14), y: a.y - a.z + 10, vx: 0, vy: 50, g: 0, life: 0.5, ch: pick([".", "*", "'"]), c: "#b8ffd4" });
          if (a.z <= 0) { s.job = "leave"; }
          break;
        case "leave":
          s.beam = Math.max(0, s.beam - dt * 2.5);
          if (s.beam <= 0) {
            a.st = "idle"; a.tm = rand(1.5, 3); a.wave = 1.8; a.vz = 0;
            s.job = null; s.alien = null; s.wait = rand(2, 5);
            s.hx = clamp(s.x, 70, W - 70); s.hy = rand(105, 150);
          }
          break;
      }
    }
  },

  /* saucers and beams are drawn over everything, so a lifted alien passes in front of the other aliens */
  over(t) {
    const ctx = world.ctx;
    for (const s of saucers) {
      const cs = s.cs;
      if (s.beam > 0.01) {
        const a = s.alien, bottom = a ? a.y + cs * 0.6 : s.y + 220, w0 = cs * 2.6, w1 = cs * 5 + (a ? 0 : 20);
        const top = s.y + cs * 1.6;
        const gr = ctx.createLinearGradient(0, top, 0, bottom);
        gr.addColorStop(0, `rgba(160,255,200,${(0.38 * s.beam).toFixed(3)})`);
        gr.addColorStop(1, `rgba(160,255,200,${(0.1 * s.beam).toFixed(3)})`);
        ctx.fillStyle = gr;
        const cx = a ? a.x : s.x, h = (bottom - top) * s.beam;
        ctx.beginPath(); ctx.moveTo(s.x - w0, top); ctx.lineTo(s.x + w0, top); ctx.lineTo(cx + w1, top + h); ctx.lineTo(cx - w1, top + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(220,255,235,${(0.5 * s.beam).toFixed(3)})`;           // glints rising in the beam
        for (let i = 0; i < 6; i++) {
          const u = ((t * 0.6 + i / 6) % 1), yy = top + h * (1 - u), xx = s.x + (cx - s.x) * (1 - u) + Math.sin(t * 3 + i * 2) * cs * 1.3;
          ctx.fillRect(xx - 1, yy, 2, 4);
        }
      }
      for (const c of SAUCER_CELLS) {                          // the saucer itself
        const lit = c.ch === "L";
        if (lit) c.fill = `hsl(${(c.ox * 40 + t * 120) % 360},95%,${55 + 15 * Math.sin(t * 6 + c.ox)}%)`;
        paintCell(c, s.x + c.ox * cs * 0.9, s.y + c.oy * cs * 0.9, cs * 0.9, t);
      }
    }
  }
};

const SAUCER_CELLS = makeCells(SAUCER, 6, 3, (ch) => {
  const n = Math.random();
  if (ch === "D") return [`hsla(185,80%,${70 + n * 10}%,.8)`, null];
  if (ch === "L") return ["#fff", null];
  return [`hsl(220,10%,${46 + n * 12}%)`, "rgba(255,255,255,.22)"];
});
