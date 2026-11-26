/*
 * Owls sit on their branches, blink slowly and now and then turn their heads a full 180 degrees.
 * Click: they spread their wings and fly off to new perches. An owl you click on
 * stays where it is, turns to look at you and hoots.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, TAU, makeCells, paintCell, pupil, spark } from "../world.js";
import { lang } from "../i18n.js";

/* front view. r ear tuft, H head, n beak, W folded wing, B belly, s belly feather, f feet */
const ROWS = [
  "r.......r",
  ".HHHHHHH.",
  ".HHHHHHH.",
  ".HHHnHHH.",
  "WBBBBBBBW",
  "WBsBsBsBW",
  ".WBsBsBW.",
  "..BBBBB..",
  "..f...f.."
];
const HEAD_ROWS = 4;
const OS = 0.8;

let list = [];

class Owl {
  constructor(x, y) {
    this.x = x; this.y = y; this.z = 0;
    this.yaw = 0; this.yawTo = 0; this.hold = rand(1, 5);
    this.blink = rand(1, 5); this.bl = 0;
    this.st = "sit"; this.react = null; this.fl = 0; this.hoot = 0;
    this.fx = x; this.fy = y; this.tx = x; this.ty = y; this.u = 0; this.dur = 1;
    this.cs = cell() * OS * rand(0.9, 1.15); this.rad = this.cs * 5; this.ay = 1;
    const hue = pick([30, 24, 36, 20, 210]), sat = hue === 210 ? 8 : 34, l0 = pick([30, 38, 24, 46]);
    this.eye = pick(["#ffcf3a", "#ffb02e", "#ffe066"]);
    this.cells = makeCells(ROWS, 4, 7, (ch, c, r) => {
      const n = Math.random();
      if (ch === "n") return ["#f0a43a", null];
      if (ch === "f") return ["#c98a3c", null];
      if (ch === "r") return [`hsl(${hue},${sat}%,${l0 - 8}%)`, null];
      if (ch === "W") return [`hsl(${hue},${sat}%,${l0 - 6 + n * 5}%)`, "rgba(255,255,255,.18)"];
      if (ch === "B" || ch === "s") return [`hsl(${hue + 8},${sat - 8}%,${l0 + 24 + n * 8}%)`, "rgba(0,0,0,.22)"];
      return [`hsl(${hue},${sat}%,${l0 + n * 7}%)`, "rgba(255,255,255,.22)"];
    });
  }

  get soft() { return false; }

  hit(ang, d) { this.react = { delay: d / cfg.wave }; }

  flyTo() {
    const { W, H } = world;
    let best = null, bd = -1;
    for (let i = 0; i < 10; i++) {                             // a free perch, as far from the others as luck allows
      const x = rand(70, W - 70), y = rand(150, H - 60);
      let m = Infinity;
      for (const o of list) if (o !== this) m = Math.min(m, Math.hypot(o.x - x, (o.y - y) * 1.4), Math.hypot((o.tx || 0) - x, ((o.ty || 0) - y) * 1.4));
      if (m > bd) { bd = m; best = [x, y]; }
    }
    this.fx = this.x; this.fy = this.y; this.tx = best[0]; this.ty = best[1];
    this.u = 0; this.dur = clamp(Math.hypot(this.tx - this.x, this.ty - this.y) / (380 * cfg.speed), 0.7, 2.2);
    this.st = "fly"; this.yawTo = 0;
  }

  update(dt, t) {
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) { this.react = null; if (this.st === "sit") this.flyTo(); }
    }
    this.yaw += (this.yawTo - this.yaw) * Math.min(1, dt * 4.5);
    if (this.st === "fly") {
      this.u += dt / this.dur;
      const u = Math.min(1, this.u), e = u * u * (3 - 2 * u);
      this.x = this.fx + (this.tx - this.fx) * e; this.y = this.fy + (this.ty - this.fy) * e;
      this.z = Math.sin(u * Math.PI) * 70 * Math.min(1.5, this.dur);
      this.fl += dt * 11;
      if (u >= 1) { this.st = "sit"; this.z = 0; this.hold = rand(1, 4); }
      return;
    }
    this.blink -= dt;
    if (this.blink <= 0) { this.bl = 0.14; this.blink = rand(1.5, 6) / Math.max(0.2, cfg.owl.blink); }
    if (this.bl > 0) this.bl -= dt;
    if (this.hoot > 0) {
      this.hoot -= dt;
      if (this.hoot <= 0) this.yawTo = 0;
      return;
    }
    this.hold -= dt;
    if (this.hold <= 0) {
      if (Math.abs(this.yawTo) < 0.1 && Math.random() < 0.35 + cfg.owl.turn * 0.65) {
        const r = Math.random(), s = Math.random() < 0.5 ? -1 : 1;
        this.yawTo = r < 0.4 ? s * Math.PI : s * rand(0.5, 1.2);   // all the way round, or a glance aside
        this.hold = this.yawTo === 0 ? 1 : rand(1.2, 2.6);
      } else { this.yawTo = 0; this.hold = rand(1.5, 5) / Math.max(0.2, cfg.owl.turn + 0.3); }
    }
  }

  /* hoot: look at the click and call out */
  call(x) {
    this.hoot = 2.2; this.yawTo = clamp((x - this.x) / 120, -0.9, 0.9);
    this.hold = 3;
    if (cfg.owl.hoot) {
      const word = lang() === "ru" ? "уху!" : "hoo!";
      spark({ x: this.x + (this.yawTo >= 0 ? 1 : -1) * this.cs * 3, y: this.y - this.cs * 7, vx: this.yawTo * 30, vy: -26, g: 0, life: 1.3, ch: word, c: "#ffe9a8" });
    }
  }

  shadow() {
    const ctx = world.ctx, cs = this.cs;
    ctx.fillStyle = "#3b2a1c";                                 // a bit of branch under the feet
    ctx.fillRect(this.x - cs * 6, this.y + cs * 1.45, cs * 12, cs * 0.9);
    ctx.fillStyle = "#4d3926"; ctx.fillRect(this.x - cs * 6, this.y + cs * 1.45, cs * 12, cs * 0.3);
    if (this.z > 0) {
      ctx.globalAlpha = 0.2; ctx.fillStyle = "#000";
      ctx.fillRect(this.x - cs * 3, this.y + cs * 2.5, cs * 6, cs * 0.7); ctx.globalAlpha = 1;
    }
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, flying = this.st === "fly";
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    const sx = 0.55 + 0.45 * Math.abs(cos), shift = sin * cs * 1.1;
    const oy = -this.z, flap = flying ? Math.sin(this.fl) : 0;
    if (flying) {                                              // the wings spread out wide
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        const px = this.x + side * (cs * (4 + i * 1.5)), py = this.y + oy - cs * 4 + flap * cs * (1 + i * 0.9) + i * cs * 0.3;
        ctx.fillStyle = `hsl(28,32%,${24 + i * 3}%)`;
        ctx.fillRect(px - cs * 0.75, py - cs * 0.5, cs * 1.5 - 1, cs * 2.2);
      }
    }
    for (const c of this.cells) {
      const head = c.oy < HEAD_ROWS - 7;
      let px = this.x + c.ox * cs, py = this.y + oy + c.oy * cs;
      if (head) {
        px = this.x + shift + c.ox * cs * sx;
        if (cos < 0 && c.ch === "n") continue;                  // the beak is on the other side
      }
      paintCell(c, px, py, cs, t);
    }
    if (cos > 0.05) {                                          // face
      const ey = this.y + oy + cs * (-5.1), fade = Math.min(1, cos * 1.6);
      for (const side of [-1, 1]) {
        const ex = this.x + shift * 1.9 + side * cs * 1.55 * (0.45 + 0.55 * cos);
        const r = cs * 1.02 * (0.55 + 0.45 * cos);
        ctx.fillStyle = "#1a1410"; ctx.beginPath(); ctx.arc(ex, ey, r * 1.18, 0, TAU); ctx.fill();
        if (this.bl > 0 && !flying) {
          ctx.fillStyle = "#2a2018"; ctx.fillRect(ex - r, ey - 1, r * 2, 3);
        } else {
          ctx.globalAlpha = fade; ctx.fillStyle = this.eye;
          ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
          pupil(ex + sin * r * 0.35, ey, r * 0.48); ctx.globalAlpha = 1;
        }
      }
    }
  }
}

export default {
  id: "owl", dot: "#d9a45c", theme: "forest", particles: "fireflies",
  density: 1 / 170000, margin: 90, glyphScale: OS,

  init(animals) { list = animals; },
  make: (x, y) => new Owl(x, y),

  poke(x, y) {
    let near = null, bd = Infinity;
    for (const o of list) { const d = Math.hypot(o.x - x, (o.y - o.cs * 4 - y)); if (d < bd) { bd = d; near = o; } }
    for (const o of list) {
      if (o === near && bd < o.cs * 6 && o.st === "sit") { o.call(x); continue; }
      const d = Math.hypot(o.x - x, o.y - y);
      if (d <= cfg.reach) o.hit(Math.atan2(o.y - y, o.x - x), d, 1 - d / cfg.reach);
    }
    return true;
  }
};
