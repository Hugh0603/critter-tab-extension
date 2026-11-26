/*
 * Penguins waddle around; now and then one drops on its belly and slides.
 * Click: a wave runs out from the spot, penguins it reaches get knocked over,
 * tumble away, lie there flapping, then stand up. They also throw snowballs
 * at each other and knock hats off.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, turn, paintCell, pupil, spark, puff, HAT_COLORS, SCARF_COLORS } from "../world.js";

/* side view, facing right. T hat brim, H hat, P pompom, B back, W belly, E eye, O beak/feet, S scarf, F flipper */
const P_BODY = [
  "...P...",
  "..HHH..",
  ".TTTTT.",
  ".BBBEB.",
  ".BBBBOO",
  ".SSSSS.",
  ".BBWWB.",
  ".BWWWB.",
  ".BWWWB.",
  ".BBWBB."
];
/* the flipper on the back side: [col, row] cells for each pose (col -1 sticks out of the body); the front one is its mirror */
const P_FLIPPERS = [
  [[0, 6], [0, 7]],                // 0 down
  [[-1, 6], [0, 6]],               // 1 out
  [[-1, 3], [-1, 4], [0, 5]]       // 2 raised
];
const FL_SEQ = [2, 1, 0, 1];       // one flap
const P_FEET = { S: ".OO.OO.", A: ".OO.O..", B: "..O.OO." };
const PS = 0.85;                   // penguins are a bit smaller than the base cell
const P_CY = 5.5;                  // sprite is 11 rows tall (10 body + feet)
const HAT_SHAPE = [[0, -1, 1], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [-2, 1, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [2, 1, 1]];   // [dx, dy, white?]

let list = [];
const balls = [], hats = [];
let slideT = 2, throwT = 4;
const every = v => rand(v * 0.6, v * 1.4);

function drawBall(x, y, s) {
  const ctx = world.ctx;
  ctx.fillStyle = "#f4f8ff"; ctx.fillRect(x - s / 2, y - s / 2, s, s);
  ctx.fillStyle = "rgba(120,150,210,.6)"; ctx.fillRect(x - s / 2, y + s * 0.1, s, s * 0.4);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x - s / 2, y - s / 2, s * 0.45, s * 0.3);
}
function drawHatShape(x, y, cs, color) {
  const ctx = world.ctx;
  for (const [dx, dy, white] of HAT_SHAPE) {
    ctx.fillStyle = white ? "#f2f6f8" : color;
    ctx.fillRect(x + dx * cs - cs / 2, y + dy * cs - cs / 2, cs - 1, cs - 1);
  }
}

class Penguin {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "stand"; this.tm = rand(0.3, 3);
    this.k = 0; this.vx = 0; this.vy = 0; this.sp = 0;
    this.fr = 0; this.frT = 0; this.rotT = 0; this.sprayT = 0;
    this.wob = 0; this.bob = 0; this.react = null;
    this.lift = 0; this.fl = 0; this.flT = 0; this.sq = 0; this.danceT = 0;
    const roll = Math.random(), P = cfg.penguin;
    this.kind = roll < P.flyers ? "flyer" : roll < P.flyers + P.dancers ? "dancer" : "walker";
    this.cs = cell() * PS;
    this.rad = this.cs * 3.4;
    this.ay = 0.55;                    // tall sprite: keep neighbours further apart vertically
    const hat = pick(HAT_COLORS), scarf = pick(SCARF_COLORS), tint = rand(-3, 3);
    const make = (rows, r0) => {
      const out = [];
      rows.forEach((row, i) => {
        for (let c = 0; c < row.length; c++) {
          const ch = row[c]; if (ch === ".") continue;
          const n = Math.random(); let fill, gc = null;
          if (ch === "B" || ch === "F") { fill = `hsl(222,30%,${15 + n * 7 + tint}%)`; gc = "rgba(150,180,240,.38)"; }
          else if (ch === "W") { fill = `hsl(210,28%,${86 + n * 8}%)`; gc = "rgba(50,70,120,.32)"; }
          else if (ch === "O") fill = `hsl(28,95%,${52 + n * 8}%)`;
          else if (ch === "S") fill = scarf;
          else if (ch === "H") fill = hat;
          else if (ch === "E") fill = "#f6f6f2";
          else fill = "#f2f6f8";           // T, P
          out.push({ ox: c - 3, oy: r0 + i + 0.5 - P_CY, ch, fill, gc, ph: Math.random() * 6, hatc: ch === "H" || ch === "T" || ch === "P" });
        }
      });
      return out;
    };
    this.hatColor = hat; this.hatOn = cfg.hats; this.lostHat = null; this.tgt = null;
    const bare = make([".BBBBB."], 2);              // the top of the head, shown when the hat is off
    for (const c of bare) c.bare = true;
    this.body = make(P_BODY, 0).concat(bare);
    this.feet = { S: make([P_FEET.S], 10), A: make([P_FEET.A], 10), B: make([P_FEET.B], 10) };
    this.flip = P_FLIPPERS.map(cells => cells.concat(cells.map(([c, r]) => [6 - c, r])).map(([c, r]) => ({ ox: c - 3, oy: r + 0.5 - P_CY, ch: "F", fill: `hsl(222,30%,${21 + Math.random() * 5}%)`, gc: "rgba(150,180,240,.38)", ph: Math.random() * 6 })));
  }

  get soft() { return this.st === "stand" || this.st === "waddle" || this.st === "dance"; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, ang, k }; }

  knock(r) {
    this.tgt = null;
    if (this.st === "puton" && !this.hatOn) { this.hatOn = true; this.lostHat = null; }
    this.st = "tumble";
    this.dir = Math.cos(r.ang) >= 0 ? 1 : -1;
    const D = (120 + 260 * r.k) * cfg.penguin.tumble;
    this.sp = D * 2.12;
    this.vx = Math.cos(r.ang); this.vy = Math.sin(r.ang);
    this.tm = 2; this.rotT = 0;
  }

  startWaddle() {
    const a = rand(0, Math.PI * 2), sp = rand(36, 58) * cfg.speed;
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.55;
    this.dir = this.vx >= 0 ? 1 : -1;
    this.st = "waddle"; this.tm = rand(1.4, 4);
  }

  startSlide() { this.st = "flop"; this.tm = 0.28; this.vx = 0; this.vy = 0; }

  rest() { return this.kind === "flyer" ? rand(0.3, 1.3) : rand(0.5, 2); }

  /* flaps its flipper and lifts off the ground; sometimes glides a bit sideways */
  startHop(glide) {
    this.st = "hop"; this.hopT = 0; this.hopDur = rand(1, 1.7);
    this.hopPeak = rand(26, 46) * cfg.size; this.hx0 = this.x;
    this.hopDist = glide ? this.dir * rand(130, 240) : 0;
    if (this.x + this.hopDist < 90 || this.x + this.hopDist > world.W - 90) { this.dir = -this.dir; this.hopDist = -this.hopDist; }
    this.fl = 0; this.flT = 0;
  }

  face() { if (this.tgt) this.dir = this.tgt.x >= this.x ? 1 : -1; }

  startThrow(target) { this.tgt = target; this.st = "scoop"; this.tm = 0.6; this.vx = this.vy = 0; this.face(); }

  throwBall() {
    const T = this.tgt; this.tgt = null;
    if (!T || !list.includes(T)) { this.st = "stand"; this.tm = this.rest(); return; }
    const cs = this.cs, dist = Math.hypot(T.x - this.x, T.y - this.y);
    const dur = Math.min(0.95, Math.max(0.45, dist / 650));
    const moving = T.st === "waddle", err = cfg.penguin.aimError;
    balls.push({
      owner: this, target: T, cs, t: 0, dur, arc: 40 + dist * 0.1, z0: cs * 9, z1: cs * 3.5,
      sx: this.x + this.dir * cs * 2.8, sy: this.y + cs * 5.2,
      lx: T.x + (moving ? T.vx * dur : 0) + rand(-1, 1) * err,
      ly: T.y + cs * 5.2 + (moving ? T.vy * dur : 0) + rand(-1, 1) * err * 0.5
    });
    this.st = "throw"; this.tm = 0.3;
  }

  startDance() { this.st = "dance"; this.tm = rand(1.6, 3.2); this.danceT = 0; }

  decide() {
    const r = Math.random();
    if (this.kind === "flyer") { if (r < 0.6) this.startHop(Math.random() < 0.5); else this.startWaddle(); }
    else if (this.kind === "dancer") { if (r < 0.5) this.startDance(); else this.startWaddle(); }
    else if (r < 0.8) this.startWaddle();
    else if (r < 0.9) this.startHop(false);
    else this.startDance();
  }

  flap(dt, gap) { this.flT -= dt; if (this.flT <= 0) { this.fl = (this.fl + 1) & 3; this.flT = gap; } }

  bounce(m) {
    const { W, H } = world;
    let hit = false;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); this.dir = 1; hit = true; }
    else if (this.x > W - m) { this.x = W - m; this.vx = -Math.abs(this.vx); this.dir = -1; hit = true; }
    if (this.y < m) { this.y = m; this.vy = Math.abs(this.vy); hit = true; }
    else if (this.y > H - m) { this.y = H - m; this.vy = -Math.abs(this.vy); hit = true; }
    return hit;
  }

  update(dt, t) {
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) { const r = this.react; this.react = null; this.knock(r); }
    }
    const m = 80;
    this.tm -= dt;
    this.bob = 0; this.wob = 0; this.lift = 0;
    if (this.sq > 0) this.sq -= dt;
    switch (this.st) {
      case "stand":
        this.k = 0;
        if (this.lostHat) { if (this.tm <= 0 && this.lostHat.landed) { this.st = "fetch"; this.frT = 0; } break; }
        if (this.tm <= 0) this.decide();
        break;
      case "scoop":                              // bends down and makes a snowball
        this.k = 0; this.face();
        this.bob = this.cs * 0.9;
        if (Math.random() < dt * 16) puff(this.x + this.dir * this.cs * 2.6, this.y + this.cs * 5, 1, 8);
        if (this.tm <= 0) { this.st = "wind"; this.tm = 0.4; }
        break;
      case "wind":                               // holds it up
        this.k = 0; this.face();
        this.wob = Math.sin(t * 30) * this.cs * 0.12;
        if (this.tm <= 0) this.throwBall();
        break;
      case "throw":
        this.k = 0;
        if (this.tm <= 0) { this.st = "stand"; this.tm = this.rest(); }
        break;
      case "stun":                               // hit by a snowball
        this.k = 0;
        this.wob = Math.sin(this.tm * 40) * this.cs * 0.3;
        if (this.tm <= 0) { this.st = "stand"; this.tm = 0.3; }
        break;
      case "fetch": {                            // walks to the hat
        const h = this.lostHat;
        if (!h) { this.st = "stand"; this.tm = this.rest(); break; }
        this.k = 0;
        const dx = h.gx - this.x, dy = h.gy - this.cs * 5.2 - this.y, d = Math.hypot(dx, dy);
        if (d < 16) { this.st = "pick"; this.tm = 0.55; break; }
        const sp = 85 * cfg.speed;
        this.x += dx / d * sp * dt; this.y += dy / d * sp * dt;
        this.dir = dx >= 0 ? 1 : -1;
        this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.14; }
        this.bob = this.fr ? -this.cs * 0.3 : 0;
        this.wob = (this.fr ? 1 : -1) * this.cs * 0.18;
        break;
      }
      case "pick": {                             // bends down for the hat
        this.k = 0;
        const pr = Math.min(1, Math.max(0, (0.55 - this.tm) / 0.55));
        this.bob = this.cs * 0.9 * Math.sin(Math.PI * pr);
        if (this.tm <= 0) {
          const i = hats.indexOf(this.lostHat); if (i >= 0) hats.splice(i, 1);
          this.st = "puton"; this.tm = 0.7;
        }
        break;
      }
      case "puton":                              // holds it up, then puts it on
        this.k = 0;
        if (!this.hatOn && this.tm <= 0.3) {
          this.hatOn = true; this.lostHat = null; this.sq = 0.18;
          puff(this.x, this.y - this.cs * 5.5, 6, 14, "#ffd25e");
        }
        if (this.tm <= 0) { this.st = "stand"; this.tm = this.rest(); }
        break;
      case "waddle":
        this.k = 0;
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.bounce(m);
        this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.2 / Math.max(0.2, cfg.speed); }
        this.bob = this.fr ? -this.cs * 0.3 : 0;
        this.wob = (this.fr ? 1 : -1) * this.cs * 0.18;
        if (this.tm <= 0) { this.st = "stand"; this.tm = this.kind === "flyer" ? rand(0.3, 1.5) : rand(1, 3.5); }
        break;
      case "hop": {
        this.k = 0;
        this.hopT += dt;
        const p = Math.min(1, this.hopT / this.hopDur);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this.x = this.hx0 + this.hopDist * e;
        this.lift = this.hopPeak * Math.pow(Math.sin(Math.PI * p), 0.8) * (1 + 0.07 * Math.sin(this.hopT * 34));
        this.flap(dt, 0.075);
        if (p >= 1) {
          this.lift = 0; this.st = "stand"; this.sq = 0.14; this.tm = this.rest();
          for (let i = 0; i < 5; i++) spark({ x: this.x + rand(-20, 20), y: this.y + this.cs * 5.2, vx: rand(-60, 60), vy: rand(-80, -20), life: rand(0.3, 0.6), ch: Math.random() < 0.5 ? "*" : "." });
        }
        break;
      }
      case "dance":
        this.k = 0;
        this.danceT -= dt;
        if (this.danceT <= 0) { this.dir = -this.dir; this.danceT = 0.17; this.fr ^= 1; }
        this.bob = this.fr ? -this.cs * 0.45 : 0;
        this.wob = (this.fr ? 1 : -1) * this.cs * 0.22;
        this.flap(dt, 0.11);
        if (this.tm <= 0) { this.st = "stand"; this.tm = this.rest(); }
        break;
      case "flop":                               // drops onto its belly
        this.k = this.dir > 0 ? 1 : 3;
        if (this.tm <= 0) { this.st = "slide"; this.sp = 330; this.vy = rand(-0.2, 0.2); this.sprayT = 0; }
        break;
      case "slide": {
        this.k = this.dir > 0 ? 1 : 3;
        this.x += this.dir * this.sp * dt; this.y += this.vy * this.sp * dt;
        this.sp *= Math.pow(0.25, dt);
        this.sprayT -= dt;
        if (this.sprayT <= 0) {
          this.sprayT = 0.04;
          spark({ x: this.x - this.dir * this.cs * 4, y: this.y + this.cs * 3, vx: -this.dir * rand(20, 90), vy: rand(-90, -20), life: rand(0.35, 0.7), ch: Math.random() < 0.5 ? "*" : "." });
        }
        if (this.bounce(m)) this.k = this.dir > 0 ? 1 : 3;
        if (this.sp < 22) { this.st = "getup"; this.tm = 0.9; this.k = 0; this.vy = 0; }
        break;
      }
      case "tumble":
        this.x += this.vx * this.sp * dt; this.y += this.vy * this.sp * dt;
        this.sp *= Math.pow(0.12, dt);
        this.rotT -= dt; if (this.rotT <= 0) { this.k = (this.k + this.dir + 4) & 3; this.rotT = 0.11; this.fr ^= 1; this.fl = (this.fl + 1) & 3; }
        this.bounce(m);
        if (this.sp < 25) { this.st = "lie"; this.k = Math.random() < 0.5 ? 1 : 3; this.dir = this.k === 1 ? 1 : -1; this.tm = rand(0.8, 1.5); }
        break;
      case "lie":                                // flapping on its back
        this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.08; this.fl = (this.fl + 1) & 3; }
        this.wob = Math.sin(t * 38) * 1.6;
        if (this.tm <= 0) { this.st = "getup"; this.tm = 0.9; this.k = 0; }
        break;
      case "getup":                              // wobbles upright
        this.k = 0;
        this.wob = Math.sin(this.tm * 34) * this.cs * 0.3 * (this.tm / 0.9);
        if (this.tm <= 0) { this.st = "stand"; this.tm = this.rest(); }
        break;
    }
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs;
    ctx.globalAlpha = 0.28 * (1 - Math.min(0.6, this.lift / 80)); ctx.fillStyle = "#000";
    if (this.k === 0) ctx.fillRect(this.x - cs * 2.4 + 3, this.y + cs * 5.2, cs * 4.8, cs * 1.4);
    else ctx.fillRect(this.x - cs * 4.5 + 3, this.y + cs * 3.1, cs * 9, cs * 1.3);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const cs = this.cs, size = this.st === "flop" ? cs * 1.08 : this.sq > 0 ? cs * 1.06 : cs;
    const k = this.k, flip = this.dir < 0 ? -1 : 1;
    const feet = this.st === "waddle" || this.st === "fetch" || this.st === "lie" || this.st === "tumble" ? (this.fr ? this.feet.A : this.feet.B) : this.feet.S;
    const paint = cells => {
      for (const c of cells) {
        if ((c.hatc && !this.hatOn) || (c.bare && this.hatOn)) continue;
        const [rx, ry] = turn(c.ox * flip, c.oy, k);
        const px = this.x + this.wob + rx * size, py = this.y + this.bob - this.lift + ry * size;
        paintCell(c, px, py, size, t);
        if (c.ch === "E") pupil(px + flip * size * 0.12, py, size * 0.2);
      }
    };
    let fi = 0;
    switch (this.st) {
      case "hop": case "dance": case "lie": case "tumble": fi = FL_SEQ[this.fl]; break;
      case "waddle": case "fetch": fi = this.fr ? 1 : 0; break;
      case "flop": case "slide": case "scoop": case "throw": case "pick": fi = 1; break;
      case "wind": case "stun": case "puton": fi = 2; break;
    }
    paint(this.body); paint(this.flip[fi]); paint(feet);
    if (this.st === "scoop") drawBall(this.x + this.wob + this.dir * cs * 2.6, this.y + this.bob + cs * 4.6, cs * (0.5 + (1 - Math.max(0, this.tm) / 0.6)));
    else if (this.st === "wind") drawBall(this.x + this.wob + this.dir * cs * 2.6, this.y - cs * 3.6, cs * 1.5);
    else if (this.st === "puton" && !this.hatOn && this.tm > 0.3) drawHatShape(this.x, this.y - cs * 7.5, cs * 0.9, this.hatColor);
  }
}

function tryThrow() {
  const busy = balls.length + list.filter(a => a.st === "scoop" || a.st === "wind" || a.st === "throw").length;
  if (busy >= 1 || list.filter(a => a.lostHat).length >= 2) return;
  const pool = list.filter(a => a.soft && a.hatOn);
  for (let n = 0; n < 6 && pool.length; n++) {
    const a = pick(pool);
    const targets = pool.filter(b => {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      return b !== a && d > 140 && d < cfg.penguin.ballRange;
    });
    if (targets.length) { a.startThrow(pick(targets)); return; }
  }
}

function landBall(b) {
  const T = b.target, cs = b.cs;
  const hittable = list.includes(T) && T.hatOn && (T.st === "stand" || T.st === "waddle" || T.st === "dance" || T.st === "hop");
  if (!(hittable && Math.abs(b.lx - T.x) < 44 && Math.abs(b.ly - (T.y + cs * 5.2)) < 42)) {
    puff(b.lx, b.ly, 8, 12);                           // missed: it just splats on the ground
    return;
  }
  puff(T.x, T.y - cs * 3, 14, 20);
  const h = { owner: T, gx: T.x, gy: T.y + cs * 5.2, z: cs * 10, vz: rand(280, 380), cs,
    vx: (T.x >= b.sx ? 1 : -1) * rand(110, 200), vy: rand(-40, 40), landed: false, bounced: false, color: T.hatColor };
  hats.push(h);
  T.hatOn = false; T.lostHat = h; T.st = "stun"; T.tm = 0.8; T.k = 0; T.vx = T.vy = 0;
  T.dir = b.sx >= T.x ? 1 : -1;
  const o = b.owner;
  if (list.includes(o) && (o.st === "throw" || o.st === "stand" || o.st === "waddle")) { o.startDance(); o.tm = 1.1; }
}

export default {
  id: "penguin", dot: "#7fb2ff", theme: "ice", particles: "snow",
  density: 1 / 95000, margin: 90, glyphScale: PS,

  init(animals) { list = animals; balls.length = 0; hats.length = 0; slideT = rand(1.5, 3); throwT = rand(3, 6); },
  make: (x, y) => new Penguin(x, y),

  update(dt) {
    const { W, H } = world, P = cfg.penguin;
    /* now and then a penguin drops on its belly and slides */
    slideT -= dt;
    if (slideT <= 0) {
      slideT = every(P.slideEvery);
      const sliding = list.filter(a => a.st === "flop" || a.st === "slide").length;
      if (sliding < P.maxSliders) {
        const ready = list.filter(a => a.soft);
        if (ready.length) pick(ready).startSlide();
      }
    }
    /* snowball fight: one penguin makes a snowball and throws it at another; a hit knocks the hat off */
    if (P.snowballs && cfg.hats) {
      throwT -= dt;
      if (throwT <= 0) { throwT = every(P.ballEvery); tryThrow(); }
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      balls[i].t += dt;
      if (balls[i].t >= balls[i].dur) { landBall(balls[i]); balls.splice(i, 1); }
    }
    for (let i = hats.length - 1; i >= 0; i--) {
      const h = hats[i];
      if (!list.includes(h.owner)) { hats.splice(i, 1); continue; }
      if (h.landed) continue;
      h.gx = Math.min(W - 30, Math.max(30, h.gx + h.vx * dt));
      h.gy = Math.min(H - 30, Math.max(70, h.gy + h.vy * dt));
      h.z += h.vz * dt; h.vz -= 900 * dt;
      if (h.z <= 0) {
        h.z = 0;
        if (!h.bounced) { h.bounced = true; h.vz = Math.abs(h.vz) * 0.3; h.vx *= 0.4; h.vy *= 0.4; }
        else { h.landed = true; h.vx = h.vy = h.vz = 0; }
      }
    }
  },

  under() {
    const ctx = world.ctx;
    for (const h of hats) {
      ctx.globalAlpha = 0.25 * (1 - Math.min(0.6, h.z / 120)); ctx.fillStyle = "#000";
      ctx.fillRect(h.gx - h.cs * 2.5 + 3, h.gy - h.cs * 0.4, h.cs * 5, h.cs * 1.1);
      ctx.globalAlpha = 1;
      if (h.landed) drawHatShape(h.gx, h.gy - h.cs * 1.1, h.cs * 0.9, h.color);
    }
  },

  over() {
    const ctx = world.ctx;
    for (const h of hats) if (!h.landed) drawHatShape(h.gx, h.gy - h.z - h.cs * 1.1, h.cs * 0.9, h.color);
    for (const b of balls) {
      const pr = b.t / b.dur, gx = b.sx + (b.lx - b.sx) * pr, gy = b.sy + (b.ly - b.sy) * pr;
      const z = b.z0 * (1 - pr) + b.z1 * pr + b.arc * Math.sin(Math.PI * pr);
      ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.fillRect(gx - b.cs * 0.7, gy - b.cs * 0.2, b.cs * 1.4, b.cs * 0.5); ctx.globalAlpha = 1;
      drawBall(gx, gy - z, b.cs * 1.5);
    }
  }
};
