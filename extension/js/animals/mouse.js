/*
 * Mice live in holes around the edges: they pop out, scurry about, sniff, and dart back in.
 * Click: a wedge of cheese drops there. Mice run over, each takes a crumb and
 * carries it home to a hole, until the cheese is gone. Right-click sends them all into hiding.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, makeCells, paintCell, pupil, lureReach } from "../world.js";

/* side view, facing right. G fur, r ear, E eye, n nose, T tail, l leg */
const BODY = [
  ".....r.r.",
  "....GGGG.",
  "T..GGGGEn",
  ".TGGGGGG."
];
const LEGS = { A: "..l...l..", B: "...l.l..." };
const HOLE = [".DDD.", "DDDDD", "DDDDD"];
/* the wedge of cheese, bottom row first, so it is eaten from the top */
const WEDGE = [[0, 0], [1, 0], [2, 0], [3, 0], [1, -1], [2, -1], [3, -1], [2, -2], [3, -2], [3, -3]];
const MS = 0.7;

let list = [];
const holes = [], cheeses = [];
let sizeKey = "";

function digHoles() {
  const { W, H } = world, key = W + "x" + H + "x" + cfg.mouse.holes;
  if (key === sizeKey && holes.length) return;
  sizeKey = key; holes.length = 0;
  for (let i = 0; i < cfg.mouse.holes; i++) {
    const side = i % 4;
    if (side === 0) holes.push({ x: rand(50, 110), y: rand(160, H - 60), n: 0 });
    else if (side === 1) holes.push({ x: W - rand(50, 110), y: rand(160, H - 60), n: 0 });
    else if (side === 2) holes.push({ x: rand(140, W - 140), y: H - rand(30, 70), n: 0 });
    else holes.push({ x: rand(140, W - 140), y: rand(120, 150), n: 0 });
  }
  for (const m of list) if (m.st === "in") { m.hole = pick(holes); m.x = m.hole.x; m.y = m.hole.y; }
}

class Mouse {
  constructor(x, y) {
    digHoles();
    this.x = x; this.y = y;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "idle"; this.tm = rand(0.3, 3);
    this.fr = 0; this.frT = 0; this.react = null;
    this.carry = false; this.cheese = null; this.hole = null; this.hideT = 0;
    this.tx = x; this.ty = y; this.sp = 0; this.next = "idle";
    this.cs = cell() * MS * rand(0.9, 1.1); this.rad = this.cs * 3.2; this.ay = 0.6;
    if (Math.random() < 0.5) { this.st = "in"; this.hole = pick(holes); this.x = this.hole.x; this.y = this.hole.y; this.tm = rand(0.5, 6); }
    const l0 = pick([42, 50, 62, 30]), hue = pick([28, 30, 215, 20]);
    const paint = ch => {
      const n = Math.random();
      if (ch === "E") return ["#f6f6f2", null];
      if (ch === "n" || ch === "T") return ["hsl(350,65%,74%)", null];
      if (ch === "r") return ["hsl(350,50%,68%)", null];
      if (ch === "l") return ["hsl(350,45%,66%)", null];
      return [`hsl(${hue},12%,${l0 + n * 7}%)`, "rgba(255,255,255,.26)"];
    };
    const pose = k => makeCells(BODY.concat(LEGS[k]), 4, BODY.length + 0.5, paint);
    this.poses = { A: pose("A"), B: pose("B") };
  }

  get soft() { return this.st === "idle"; }

  hit(ang, d) { this.react = { delay: d / cfg.wave }; }

  nearestHole() {
    let best = holes[0], bd = Infinity;
    for (const h of holes) { const d = Math.hypot(h.x - this.x, h.y - this.y); if (d < bd) { bd = d; best = h; } }
    return best;
  }

  run(tx, ty, sp, next) {
    this.tx = tx; this.ty = ty; this.sp = sp * Math.max(0.5, cfg.speed); this.next = next; this.st = "run";
  }

  home(sp, hide) { const h = this.nearestHole(); this.hole = h; this.hideT = hide; this.run(h.x, h.y, sp, "enter"); }

  drop() { if (this.cheese) { this.cheese.claim--; this.cheese = null; } }

  /* is there cheese worth going for? */
  findCheese() {
    let best = null, bd = lureReach() * 1.6;
    for (const c of cheeses) {
      if (c.z > 0 || c.bites - c.claim <= 0) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return false;
    best.claim++; this.cheese = best;
    this.run(best.x - rand(-1, 1) * this.cs * 3, best.y + rand(0, 6), 230, "bite");
    return true;
  }

  update(dt) {
    const { W, H } = world;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        this.react = null;
        if (this.st !== "in") { this.drop(); this.carry = false; this.home(330, rand(2, 5) * cfg.mouse.shy); }
        else this.tm = Math.max(this.tm, rand(2, 5) * cfg.mouse.shy);
      }
    }
    this.tm -= dt;
    switch (this.st) {
      case "in":
        if (this.tm <= 0) {
          if (this.findCheese()) break;
          if (Math.random() < 0.65) this.run(rand(70, W - 70), rand(130, H - 40), rand(90, 150), "idle");
          else this.tm = rand(1, 4);
        }
        break;
      case "idle":
        if (this.tm <= 0) {
          if (this.findCheese()) break;
          if (Math.random() < 0.4) this.home(rand(110, 170), rand(1, 5));
          else this.run(Math.min(W - 70, Math.max(70, this.x + rand(-260, 260))), Math.min(H - 40, Math.max(130, this.y + rand(-160, 160))), rand(90, 150), "idle");
        }
        break;
      case "run": {
        const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
        if (d > 6) {
          const v = Math.min(this.sp * dt, d);
          this.x += dx / d * v; this.y += dy / d * v;
          this.dir = dx >= 0 ? 1 : -1;
          this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.06; }
          break;
        }
        if (this.next === "enter") { this.st = "in"; this.tm = this.hideT || rand(1, 4); this.carry = false; }
        else if (this.next === "bite") {
          const c = this.cheese; this.cheese = null;
          if (c && c.bites > 0) { c.claim--; c.bites--; this.carry = true; this.home(170, rand(0.4, 1.2)); }
          else { this.st = "idle"; this.tm = rand(0.3, 1.5); }
        } else { this.st = "idle"; this.tm = rand(0.5, 2.5); }
        break;
      }
    }
  }

  shadow() {
    if (this.st === "in") return;
    const ctx = world.ctx, cs = this.cs;
    ctx.globalAlpha = 0.26; ctx.fillStyle = "#000";
    ctx.fillRect(this.x - cs * 4 + 2, this.y - cs * 0.3, cs * 8, cs);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    if (this.st === "in") return;
    const ctx = world.ctx, cs = this.cs, flip = this.dir < 0 ? -1 : 1;
    const cells = this.st === "run" && this.fr ? this.poses.B : this.poses.A;
    const sniff = this.st === "idle" ? Math.sin(t * 14) * cs * 0.1 : 0;
    for (const c of cells) {
      const head = c.ch === "n" || c.ch === "E";
      const px = this.x + c.ox * flip * cs, py = this.y + c.oy * cs + (head ? sniff : 0);
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px, py, cs * 0.3);
    }
    if (this.carry) {                                         // a crumb of cheese in its mouth
      ctx.fillStyle = "hsl(48,95%,58%)";
      ctx.fillRect(this.x + flip * cs * 5 - cs * 0.6, this.y - cs * 2.4, cs * 1.2, cs * 1.2);
    }
  }
}

export default {
  id: "mouse", dot: "#c9c2b8", theme: "hearth", particles: "fireflies",
  density: 1 / 110000, margin: 110, glyphScale: MS,

  init(animals) { list = animals; cheeses.length = 0; sizeKey = ""; },
  make: (x, y) => new Mouse(x, y),

  poke(x, y) {
    if (cheeses.length >= 4) cheeses.shift();
    cheeses.push({ x, y, z: 70, vz: 0, bites: cfg.mouse.cheese, claim: 0 });
    for (const m of list) if (m.st === "in" || m.st === "idle") m.tm = Math.min(m.tm, rand(0.35, 1.6));   // they smell it
    return true;
  },

  update(dt, t) {
    digHoles();
    for (const h of holes) h.n = 0;
    for (const m of list) if (m.st === "in" && m.hole) m.hole.n++;
    for (let i = cheeses.length - 1; i >= 0; i--) {
      const c = cheeses[i];
      if (c.z > 0) { c.vz += 600 * dt; c.z = Math.max(0, c.z - c.vz * dt); }
      else if (c.bites <= 0 && c.claim <= 0) cheeses.splice(i, 1);
    }
  },

  under(t) {
    const ctx = world.ctx, cs = cell() * 0.9;
    for (const h of holes) {
      for (const rim of [true, false]) {                       // a lighter rim first, then the dark inside
        ctx.fillStyle = rim ? "#4a382a" : "#040305";
        HOLE.forEach((row, r) => {
          for (let c = 0; c < row.length; c++) {
            if (row[c] === ".") continue;
            const px = h.x + (c - 2) * cs - cs / 2, py = h.y + (r - 2.5) * cs - cs / 2;
            if (rim) ctx.fillRect(px - 2, py - 2, cs + 3, cs + 1); else ctx.fillRect(px, py, cs - 1, cs - 1);
          }
        });
      }
      if (h.n > 0 && Math.sin(t * 0.9 + h.x) > -0.75) {       // someone is watching from inside
        ctx.fillStyle = "rgba(255,244,214,.85)";
        ctx.fillRect(h.x - cs * 0.8, h.y - cs * 1.5, cs * 0.35, cs * 0.35);
        ctx.fillRect(h.x + cs * 0.45, h.y - cs * 1.5, cs * 0.35, cs * 0.35);
      }
    }
    const s = cell() * 0.8;
    for (const c of cheeses) {
      ctx.globalAlpha = 0.22; ctx.fillStyle = "#000"; ctx.fillRect(c.x - s * 2 + 3, c.y - s * 0.3, s * 4.4, s * 0.9); ctx.globalAlpha = 1;
      for (let i = 0; i < Math.min(c.bites, WEDGE.length); i++) {
        const [ox, oy] = WEDGE[i], px = c.x + (ox - 1.5) * s, py = c.y - c.z + (oy - 0.5) * s;
        ctx.fillStyle = (i * 7) % 3 === 0 ? "hsl(44,92%,50%)" : "hsl(48,96%,60%)";
        ctx.fillRect(px - s / 2, py - s / 2, s - 1, s - 1);
      }
    }
  }
};
