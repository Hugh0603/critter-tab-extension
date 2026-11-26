/*
 * Bees buzz around their hives. Click: a flower grows; bees fly to it, gather
 * pollen and carry it home. Right-click: the ones the wave reaches get angry
 * and chase your cursor in a swarm until they calm down.
 */
import { cfg } from "../settings.js";
import { world, rand, clamp, cell, TAU, angDiff, makeCells, paintCell, lureReach } from "../world.js";
import { plantFlower, ageFlowers, drawFlowers } from "./flora.js";

/* seen from above, head up. K dark, Y yellow, w wing */
const ROWS = [
  ".wKw.",
  "wwYww",
  ".wKw.",
  "..Y.."
];
const HIVE = ["..HHH..", ".HhHhH.", "HHHHHHH", ".hHdHh.", "..HdH.."];
const BS = 0.6;

const hives = [], flowers = [];
let sizeKey = "";

function placeHives() {
  const { W, H } = world, n = cfg.bee.hives, key = W + "x" + H + "x" + n;
  if (key === sizeKey && hives.length) return;
  sizeKey = key; hives.length = 0;
  for (let i = 0; i < n; i++) hives.push({ x: W * (i + 1) / (n + 1) + rand(-60, 60), y: i % 2 ? H - rand(90, 130) : rand(130, 180) });
}

class Bee {
  constructor(x, y) {
    placeHives();
    this.x = x; this.y = y;
    this.a = rand(0, TAU); this.ph = rand(0, 6);
    this.hive = hives[Math.floor(Math.random() * hives.length)];
    this.st = "roam"; this.tm = 0; this.tx = x; this.ty = y;
    this.pollen = false; this.flower = null; this.angry = 0; this.react = null;
    this.orbit = rand(0, TAU); this.orbitR = rand(20, 80);
    this.cs = cell() * BS * rand(0.85, 1.15); this.rad = this.cs * 2; this.ay = 1;
    this.cells = makeCells(ROWS, 2, 1.5, ch => {
      if (ch === "w") return ["rgba(235,245,255,.6)", null];
      if (ch === "K") return ["hsl(30,25%,14%)", null];
      return [`hsl(${46 + Math.random() * 6},95%,56%)`, "rgba(90,50,0,.3)"];
    });
  }

  get soft() { return false; }

  hit(ang, d, k) { this.react = { delay: d / cfg.wave, k }; }

  update(dt, t) {
    const { W, H, mouse } = world;
    if (!hives.includes(this.hive)) this.hive = hives[Math.floor(Math.random() * hives.length)];
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) { this.angry = cfg.bee.anger * rand(0.7, 1.3); this.react = null; this.flower = null; this.st = "roam"; }
    }
    let sp = 95, turn = 5;
    if (this.angry > 0) {                                      // swarm around the cursor
      this.angry -= dt; this.orbit += dt * 5;
      const cx = mouse.on ? mouse.x : W / 2, cy = mouse.on ? mouse.y : H / 2;
      this.tx = cx + Math.cos(this.orbit) * this.orbitR; this.ty = cy + Math.sin(this.orbit) * this.orbitR;
      sp = 300; turn = 11;
    } else {
      this.tm -= dt;
      switch (this.st) {
        case "roam":
          if (this.tm <= 0) {
            let best = null, bd = lureReach() * 1.5;
            if (!this.pollen) for (const f of flowers) {
              if (f.gone || f.life - f.age < 3) continue;
              const d = Math.hypot(f.x - this.x, f.y - this.y);
              if (d < bd && Math.random() < 0.8) { bd = d; best = f; }
            }
            if (best) { this.flower = best; this.st = "toFlower"; this.tx = best.x + rand(-10, 10); this.ty = best.y + rand(-10, 10); }
            else { this.tx = this.hive.x + rand(-190, 190); this.ty = this.hive.y + rand(-150, 150); this.tm = rand(0.6, 2); }
          }
          break;
        case "toFlower":
          if (!this.flower || this.flower.gone) { this.st = "roam"; this.tm = 0; break; }
          sp = 150;
          if (Math.hypot(this.tx - this.x, this.ty - this.y) < 12) { this.st = "sip"; this.tm = rand(1.5, 3.5); }
          break;
        case "sip":                                            // hovers on the flower
          sp = 14;
          this.tx = this.flower ? this.flower.x + Math.cos(t * 3 + this.ph) * 8 : this.x; this.ty = this.flower ? this.flower.y + Math.sin(t * 4 + this.ph) * 8 : this.y;
          if (this.tm <= 0 || !this.flower || this.flower.gone) { this.pollen = !!this.flower && !this.flower.gone; this.flower = null; this.st = "toHive"; }
          break;
        case "toHive":
          sp = 135; this.tx = this.hive.x; this.ty = this.hive.y + cell() * 1.5;
          if (Math.hypot(this.tx - this.x, this.ty - this.y) < 12) { this.st = "inHive"; this.tm = rand(0.5, 1.5); this.pollen = false; }
          break;
        case "inHive":
          if (this.tm <= 0) { this.st = "roam"; this.tm = 0; }
          return;
      }
    }
    const want = Math.atan2(this.ty - this.y, this.tx - this.x);
    this.a += clamp(angDiff(want, this.a), -turn * dt, turn * dt) + Math.sin(t * 9 + this.ph) * 1.6 * dt;
    const v = sp * cfg.speed;
    this.x = clamp(this.x + Math.cos(this.a) * v * dt, 10, W - 10);
    this.y = clamp(this.y + Math.sin(this.a) * v * dt, 10, H - 10);
  }

  shadow() {
    if (this.st === "inHive") return;
    const ctx = world.ctx;
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#000";
    ctx.fillRect(this.x + 5 - this.cs, this.y + 10, this.cs * 2, this.cs * 1.4);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    if (this.st === "inHive") return;
    const ctx = world.ctx, cs = this.cs, f = 0.35 + 0.65 * Math.abs(Math.sin(t * 40 + this.ph));
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.a + Math.PI / 2);
    for (const c of this.cells) {
      if (c.ch === "w") paintCell(c, c.ox * cs * f, c.oy * cs, cs, t, cs * f + 1);
      else {
        paintCell(c, c.ox * cs, c.oy * cs, cs, t);
        if (this.angry > 0 && c.ch === "Y") { ctx.fillStyle = "rgba(255,40,40,.55)"; ctx.fillRect(c.ox * cs - cs / 2, c.oy * cs - cs / 2, cs - 1, cs - 1); }
      }
    }
    if (this.pollen) { ctx.fillStyle = "#ffe066"; ctx.fillRect(-cs * 0.5, cs * 2.2, cs, cs); }
    ctx.restore();
  }
}

export default {
  id: "bee", dot: "#ffd23e", theme: "forest", particles: "sakura",
  density: 1 / 60000, margin: 60, glyphScale: BS, separate: false,

  init() { flowers.length = 0; sizeKey = ""; },
  make: (x, y) => new Bee(x, y),

  poke(x, y) { plantFlower(flowers, x, y, cfg.bee.flowerLife, 12); return true; },

  update(dt) { placeHives(); ageFlowers(flowers, dt); },

  under() {
    const ctx = world.ctx, cs = cell() * 1.1;
    drawFlowers(flowers);
    for (const h of hives) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.fillRect(h.x - cs * 3.5 + 4, h.y + cs * 2.2, cs * 7, cs); ctx.globalAlpha = 1;
      HIVE.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          const ch = row[c]; if (ch === ".") continue;
          ctx.fillStyle = ch === "d" ? "#1c1206" : ch === "h" ? "hsl(36,70%,38%)" : `hsl(42,85%,${r % 2 ? 50 : 56}%)`;
          ctx.fillRect(h.x + (c - 3) * cs - cs / 2, h.y + (r - 2) * cs - cs / 2, cs - 1, cs - 1);
        }
      });
    }
  }
};
