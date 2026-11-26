/*
 * Chameleons creep about, eyes swivelling, slowly fading into the colour of the background.
 * Click: a fly appears there. The nearest chameleon creeps into range and
 * snatches it with its tongue, then flushes with colour. Right-click startles
 * them into bright colours.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, TAU, makeCells, shimmer, pupil, lureReach } from "../world.js";
import { themeColors } from "../themes.js";

/* side view, facing right. C body, s stripe, E eye, m mouth, T tail, L leg */
const BODY = [
  "......CCCC..",
  ".TT..CsCCEC.",
  "T..TCCsCCCCm",
  "T.TCCsCCsC..",
  ".TT.CCCCC..."
];
const LEGS = { A: "....L..L....", B: "...L....L..." };
const KS = 0.85;

let list = [];
const flies = [];

function hexHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [220, 30, 20];
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
let camoKey = "", camo = [220, 30, 30];
function camoColor() {                                         // the background's colour, a little lighter so they stay findable
  const bg = themeColors({ theme: "swamp" }).bg2;
  if (bg !== camoKey) { camoKey = bg; const [h, s, l] = hexHsl(bg); camo = [h, Math.min(60, s), Math.min(70, l + 13)]; }
  return camo;
}

class Chameleon {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "rest"; this.tm = rand(0.5, 4);
    this.vx = 0; this.vy = 0; this.fr = 0; this.frT = 0; this.react = null;
    this.hue = pick([110, 150, 55, 185, 300, 20]); this.excite = 1;
    this.eye = rand(0, TAU); this.eyeGoal = this.eye; this.eyeT = 0;
    this.fly = null; this.tongue = 0; this.chew = 0;
    this.cs = cell() * KS * rand(0.85, 1.15); this.rad = this.cs * 4.4; this.ay = 0.6;
    const pose = k => makeCells(BODY.concat(LEGS[k]), 6, BODY.length + 0.5, ch => [ch, "rgba(255,255,255,.28)"]);
    this.poses = { A: pose("A"), B: pose("B") };
  }

  get soft() { return this.st === "rest" || this.st === "walk"; }

  hit(ang, d) { this.react = { delay: d / cfg.wave }; }

  mouth() { return { x: this.x + this.dir * this.cs * 5.5, y: this.y - this.cs * 3 }; }

  update(dt) {
    const { W, H } = world, cs = this.cs;
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) { this.react = null; this.excite = 1; this.hue = pick([0, 50, 320]); if (!this.fly) { this.st = "rest"; this.tm = rand(1, 2.5); } }
    }
    this.excite = Math.max(0, this.excite - dt / cfg.chameleon.camo);
    if (this.chew > 0) this.chew -= dt;
    /* the eye wanders on its own, unless there is a fly to watch */
    this.eyeT -= dt;
    if (this.eyeT <= 0) { this.eyeGoal = rand(0, TAU); this.eyeT = rand(0.4, 2); }
    const f = this.fly;
    if (f && (f.gone || !flies.includes(f))) { this.fly = null; this.tongue = 0; this.st = "rest"; this.tm = rand(0.5, 2); }
    if (this.fly) {
      const m = this.mouth(), dx = f.x - m.x, dy = f.y - m.y, d = Math.hypot(dx, dy);
      this.eyeGoal = Math.atan2(dy, dx * this.dir);
      switch (this.st) {
        case "aim":
          this.tm -= dt;
          if (this.tm <= 0) { this.st = "shoot"; this.tongue = 0; }
          break;
        case "shoot":
          this.tongue += 1700 * dt;
          if (this.tongue >= d) { this.tongue = d; f.caught = true; this.st = "back"; }
          break;
        case "back":
          this.tongue -= 1300 * dt;
          f.x = m.x + dx / (d || 1) * Math.max(0, this.tongue); f.y = m.y + dy / (d || 1) * Math.max(0, this.tongue);
          if (this.tongue <= 0) { f.gone = true; this.fly = null; this.chew = 0.7; this.excite = 1; this.hue = pick([110, 150, 55, 185, 300, 20]); this.st = "rest"; this.tm = rand(1.5, 3); }
          break;
        default:                                               // creep closer until the tongue can reach
          this.dir = f.x >= this.x ? 1 : -1;
          if (d < cfg.chameleon.tongue) { this.st = "aim"; this.tm = 0.3; break; }
          this.st = "stalk";
          this.x += Math.sign(f.x - this.x) * Math.min(Math.abs(f.x - this.x), 55 * cfg.speed * dt);
          this.y += Math.sign(f.y + 60 - this.y) * Math.min(Math.abs(f.y + 60 - this.y), 30 * cfg.speed * dt);
          this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.3; }
      }
    } else {
      this.tm -= dt;
      if (this.st === "walk") {
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.x < 80) { this.x = 80; this.vx = Math.abs(this.vx); this.dir = 1; } else if (this.x > W - 80) { this.x = W - 80; this.vx = -Math.abs(this.vx); this.dir = -1; }
        if (this.y < 150) { this.y = 150; this.vy = Math.abs(this.vy); } else if (this.y > H - 30) { this.y = H - 30; this.vy = -Math.abs(this.vy); }
        this.frT -= dt; if (this.frT <= 0) { this.fr ^= 1; this.frT = 0.42 / Math.max(0.3, cfg.speed); }
        if (this.tm <= 0) { this.st = "rest"; this.tm = rand(1.5, 6); }
      } else if (this.tm <= 0) {
        const a = rand(0, TAU), sp = rand(10, 20) * cfg.speed;
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.5; this.dir = this.vx >= 0 ? 1 : -1;
        this.st = "walk"; this.tm = rand(2, 7);
      }
    }
    let d = (this.eyeGoal - this.eye) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    this.eye += d * Math.min(1, dt * 6);
    if (cs > 0 && this.st === "stalk" && !this.fly) this.st = "rest";
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs;
    ctx.globalAlpha = 0.26; ctx.fillStyle = "#000";
    ctx.fillRect(this.x - cs * 5.5 + 3, this.y - cs * 0.35, cs * 11, cs * 1.1);
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, flip = this.dir < 0 ? -1 : 1, k = this.excite;
    const [ch, csat, cl] = camoColor();
    let dh = (this.hue - ch) % 360; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    const h = ch + dh * k, s = csat + (72 - csat) * k, l = cl + (52 - cl) * k;
    const body = `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`, stripe = `hsl(${(h + 40 * k).toFixed(0)},${s.toFixed(0)}%,${(l - 9 - 6 * k).toFixed(0)}%)`;
    const moving = this.st === "walk" || this.st === "stalk";
    const rock = moving ? Math.sin(t * 5) * cs * 0.18 : 0;     // that hesitant rocking walk
    const cells = moving && this.fr ? this.poses.B : this.poses.A;
    if (this.fly && this.tongue > 0) {
      const m = this.mouth(), f = this.fly, d = Math.hypot(f.x - m.x, f.y - m.y) || 1;
      const ex = m.x + (f.x - m.x) / d * this.tongue, ey = m.y + (f.y - m.y) / d * this.tongue;
      ctx.strokeStyle = "#ff7d9c"; ctx.lineWidth = Math.max(2, cs * 0.35);
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#ff5d7c"; ctx.beginPath(); ctx.arc(ex, ey, cs * 0.45, 0, TAU); ctx.fill();
    }
    for (const c of cells) {
      const px = this.x + rock + c.ox * flip * cs;
      let py = this.y + c.oy * cs;
      if (c.ch === "m" && this.chew > 0) py += Math.sin(t * 30) * cs * 0.2;
      if (c.ch === "E") {
        ctx.fillStyle = "#f6f6f2"; ctx.fillRect(px - cs * 0.65, py - cs * 0.65, cs * 1.3, cs * 1.3);
        pupil(px + Math.cos(this.eye) * flip * cs * 0.3, py + Math.sin(this.eye) * cs * 0.3, cs * 0.26);
        continue;
      }
      ctx.fillStyle = c.ch === "s" || c.ch === "L" ? stripe : body;
      ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
      if (world.glyphsOn) { ctx.fillStyle = c.gc; ctx.fillText(shimmer(c, t), px, py); }
    }
  }
}

export default {
  id: "chameleon", dot: "#9be15d", theme: "swamp", particles: "leaves",
  density: 1 / 150000, margin: 110, glyphScale: KS,

  init(animals) { list = animals; flies.length = 0; },
  make: (x, y) => new Chameleon(x, y),

  poke(x, y) {
    if (flies.length >= 6) flies.shift().gone = true;
    flies.push({ x, y, ox: x, oy: y, ph: rand(0, 6), age: 0, caught: false, gone: false, by: null });
    return true;
  },

  update(dt, t) {
    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i];
      f.age += dt;
      if (f.gone || (f.age > 25 && !f.by)) { f.gone = true; flies.splice(i, 1); continue; }
      if (!f.caught) { f.x = f.ox + Math.sin(t * 7 + f.ph) * 9 + Math.sin(t * 2.3 + f.ph) * 14; f.y = f.oy + Math.cos(t * 6 + f.ph * 2) * 8; }
      if (f.by && (!list.includes(f.by) || f.by.fly !== f)) f.by = null;
      if (!f.by) {                                             // the nearest free chameleon takes it on
        let best = null, bd = lureReach() * 2.5;
        for (const c of list) {
          if (c.fly) continue;
          const d = Math.hypot(c.x - f.x, c.y - f.y);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) { f.by = best; best.fly = f; best.st = "stalk"; }
      }
    }
  },

  over(t) {
    const ctx = world.ctx, s = Math.max(3, cell() * 0.35);
    for (const f of flies) {
      const w = Math.abs(Math.sin(t * 50 + f.ph)) * s;
      ctx.fillStyle = "rgba(230,240,255,.6)"; ctx.fillRect(f.x - s / 2 - w, f.y - s, w, s * 0.6); ctx.fillRect(f.x + s / 2, f.y - s, w, s * 0.6);
      ctx.fillStyle = "#15161c"; ctx.fillRect(f.x - s / 2, f.y - s / 2, s, s);
    }
  }
};
