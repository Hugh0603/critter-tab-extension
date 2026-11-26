/*
 * A duck family: mother in front, ducklings in a line behind her, all gliding over the pond.
 * Click: the ducklings scatter in every direction. The mother stops, quacks,
 * and one by one they paddle back and fall into line behind her again.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, makeCells, paintCell, pupil, spark } from "../world.js";
import { lang } from "../i18n.js";

/* side view, facing right, the waterline under the last row. G head, E eye, b beak, B body, T tail, W wing */
const MOM = [
  "......GGG..",
  "......GEGbb",
  ".T....GGG..",
  "TBBBBBBBB..",
  ".BWWBBBBB.."
];
const KID = [
  "..Y..",
  ".YEb.",
  "YYY..",
  "YYYY."
];
const DS = 0.75;

class Chick {
  constructor(i, cs) {
    this.i = i; this.st = "chain"; this.x = 0; this.y = 0; this.dir = 1; this.vx = 0; this.vy = 0; this.tm = 0;
    this.ph = rand(0, 6); this.cs = cs * 0.66;
    const h = rand(44, 52);
    this.cells = makeCells(KID, 2, 3.5, ch => {
      if (ch === "E") return ["#1a1a1a", null];
      if (ch === "b") return ["#ff9a3d", null];
      return [`hsl(${h},95%,${58 + Math.random() * 10}%)`, "rgba(120,80,0,.22)"];
    });
  }
}

class Family {
  constructor(x, y) {
    this.x = x; this.y = y; this.ang = rand(0, TAU); this.turn = 0; this.tm = rand(1, 4);
    this.cs = cell() * DS * rand(0.95, 1.15); this.rad = this.cs * 7; this.ay = 1;
    this.path = [{ x, y }]; this.react = null; this.call = 0; this.ph = rand(0, 6);
    this.gap = this.cs * 3.3;
    const hue = pick([28, 24, 32]), head = pick([140, 150, 185]);
    this.mom = makeCells(MOM, 5, 4.5, ch => {
      const n = Math.random();
      if (ch === "E") return ["#101010", null];
      if (ch === "b") return ["#ffb030", null];
      if (ch === "G") return [`hsl(${head},45%,${28 + n * 8}%)`, "rgba(255,255,255,.2)"];
      if (ch === "W") return [`hsl(${hue},30%,${28 + n * 6}%)`, null];
      if (ch === "T") return [`hsl(${hue},28%,24%)`, null];
      return [`hsl(${hue},32%,${42 + n * 9}%)`, "rgba(255,255,255,.22)"];
    });
    this.kids = [];
    for (let i = 0; i < cfg.duck.chicks; i++) this.kids.push(new Chick(i, this.cs));
    this.layOut();
  }

  get soft() { return false; }

  hit(ang, d) { this.react = { delay: d / cfg.wave, ang }; }

  /* before the first step, string the line out behind the mother */
  layOut() {
    const L = this.gap * (this.kids.length + 2);
    this.path = [];
    for (let s = 0; s <= L; s += 4) this.path.push({ x: this.x - Math.cos(this.ang) * s, y: this.y - Math.sin(this.ang) * s });
    this.kids.forEach(k => { const p = this.at((k.i + 1) * this.gap); k.x = p.x; k.y = p.y; k.dir = Math.cos(this.ang) >= 0 ? 1 : -1; });
  }

  /* the point d px back along the track the mother has swum */
  at(d) {
    let px = this.x, py = this.y;
    for (const p of this.path) {
      const seg = Math.hypot(p.x - px, p.y - py);
      if (seg >= d) { const k = d / (seg || 1); return { x: px + (p.x - px) * k, y: py + (p.y - py) * k }; }
      d -= seg; px = p.x; py = p.y;
    }
    return { x: px, y: py };
  }

  update(dt, t) {
    const { W, H } = world;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        const away = this.react.ang; this.react = null;
        for (const k of this.kids) {
          if (k.st === "chain") {
            const a = away + rand(-2.4, 2.4), v = rand(230, 360);
            k.st = "scatter"; k.vx = Math.cos(a) * v; k.vy = Math.sin(a) * v * 0.7;
            k.tm = cfg.duck.scatter * rand(0.55, 1.2);
          }
        }
        this.call = 0.1;
      }
    }
    let lost = 0;
    for (const k of this.kids) if (k.st !== "chain") lost++;

    /* the mother: wander, keep off the edges, slow down to call her ducklings */
    this.tm -= dt;
    if (this.tm <= 0) { this.turn = rand(-0.9, 0.9); this.tm = rand(1.5, 5); }
    const m = 110, sx = this.x < m ? 1 : this.x > W - m ? -1 : 0, sy = this.y < m + 40 ? 1 : this.y > H - m ? -1 : 0;
    if (sx || sy) {
      const want = Math.atan2(sy || (H / 2 - this.y) * 0.002, sx || (W / 2 - this.x) * 0.002);
      let d = want - this.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ang += clamp(d, -1, 1) * dt * 2.2;
    } else this.ang += this.turn * dt * 0.5;
    const v = 38 * cfg.speed * (lost ? 0.12 : 1) * (0.85 + 0.15 * Math.sin(t * 1.3 + this.ph));
    const nx = this.x + Math.cos(this.ang) * v * dt, ny = this.y + Math.sin(this.ang) * v * dt;
    const moved = Math.hypot(nx - this.x, ny - this.y);
    this.x = nx; this.y = ny;
    const head = this.path[0];
    if (!head || Math.hypot(head.x - this.x, head.y - this.y) > 3) {
      this.path.unshift({ x: this.x, y: this.y });
      const keep = this.gap * (this.kids.length + 3);                   // do not remember more than the line needs
      let acc = 0, n = 1;
      for (let i = 1; i < this.path.length; i++) { acc += Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y); n = i + 1; if (acc > keep) break; }
      this.path.length = n;
    }
    if (lost && cfg.duck.quack) {
      this.call -= dt;
      if (this.call <= 0) {
        this.call = rand(0.9, 1.6);
        spark({ x: this.x + (Math.cos(this.ang) >= 0 ? 1 : -1) * this.cs * 2, y: this.y - this.cs * 6, vx: rand(-15, 15), vy: -30, g: 0, life: 1.1, ch: lang() === "ru" ? "кря!" : "quack!", c: "#ffe9a8" });
      }
    }

    for (const k of this.kids) {
      if (k.st === "chain") {
        const p = this.at((k.i + 1) * this.gap), dx = p.x - k.x;
        if (Math.abs(dx) > 0.5) k.dir = dx > 0 ? 1 : -1;
        k.x = p.x; k.y = p.y;
      } else if (k.st === "scatter") {
        k.tm -= dt;
        k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= Math.pow(0.5, dt * 0.8); k.vy *= Math.pow(0.5, dt * 0.8);
        k.vx += rand(-90, 90) * dt; k.vy += rand(-90, 90) * dt;
        if (k.x < 30 || k.x > W - 30) k.vx = -k.vx * 0.7;
        if (k.y < 100 || k.y > H - 30) k.vy = -k.vy * 0.7;
        k.x = clamp(k.x, 30, W - 30); k.y = clamp(k.y, 100, H - 30);
        if (Math.abs(k.vx) > 5) k.dir = k.vx > 0 ? 1 : -1;
        if (k.tm <= 0) k.st = "back";
      } else {                                                           // paddling back to its place in line
        const p = this.at((k.i + 1) * this.gap), dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
        const sp = 190 * cfg.speed;
        if (d < 10) { k.st = "chain"; continue; }
        const s = Math.min(d, sp * dt);
        k.x += dx / d * s; k.y += dy / d * s; if (Math.abs(dx) > 1) k.dir = dx > 0 ? 1 : -1;
      }
    }
    this.moving = moved > 0.01;
  }

  shadow() {}

  paint(cells, x, y, dir, cs, t, ph) {
    const bob = Math.sin(t * 2.6 + ph) * cs * 0.14;
    for (const c of cells) {
      const px = x + c.ox * dir * cs, py = y + c.oy * cs + bob;
      paintCell(c, px, py, cs, t);
      if (c.ch === "E") pupil(px, py, cs * 0.25);
    }
  }

  draw(t) {
    for (let i = this.kids.length - 1; i >= 0; i--) { const k = this.kids[i]; this.paint(k.cells, k.x, k.y, k.dir, k.cs, t, k.ph); }
    this.paint(this.mom, this.x, this.y, Math.cos(this.ang) >= 0 ? 1 : -1, this.cs, t, this.ph);
  }
}

let list = [];

export default {
  id: "duck", dot: "#ffd23e", theme: "pond", particles: "leaves",
  density: 1 / 550000, margin: 140, glyphScale: DS, separate: false,

  init(animals) { list = animals; },
  make: (x, y) => new Family(x, y),

  /* rings of water round everyone who is swimming */
  under(t) {
    if (!cfg.duck.wake) return;
    const ctx = world.ctx;
    ctx.lineWidth = 1;
    for (const f of list) {
      const ring = (x, y, r, ph) => {
        for (let j = 0; j < 2; j++) {
          const u = ((t * 0.5 + ph + j * 0.5) % 1);
          ctx.strokeStyle = `rgba(190,230,255,${(0.22 * (1 - u)).toFixed(3)})`;
          ctx.beginPath(); ctx.ellipse(x, y + 1, r * (0.7 + u * 0.9), r * (0.7 + u * 0.9) * 0.3, 0, 0, TAU); ctx.stroke();
        }
      };
      ring(f.x - f.cs, f.y, f.cs * 5.2, f.ph);
      for (const k of f.kids) ring(k.x, k.y, k.cs * 4, k.ph);
    }
  }
};
