/*
 * Snails crawl slowly and leave a shiny trail behind them.
 * Click: the ones the wave reaches pull into their shells. After a while, one by one,
 * they put out their eye stalks, look around, and carry on.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, clamp, cell, makeCells, paintCell, pupil } from "../world.js";

/* S shell, s shell swirl, B body (foot and head) */
const ROWS = [
  "..SSSS......",
  ".SSssSS.....",
  ".SsSSsS.....",
  ".SSssSSBB...",
  "BBBBBBBBBBB."
];
const SS = 0.8, HEAD = 8.5;

let list = [];

class Snail {
  constructor(x, y) {
    this.x = x; this.y = y; this.dir = Math.random() < 0.5 ? 1 : -1;
    this.st = "crawl"; this.tm = rand(2, 8); this.tx = x; this.ty = y;
    this.bd = 1; this.sk = 1;                                  // how far the body and the eye stalks are out
    this.react = null; this.hold = 0; this.stage = 0; this.ph = rand(0, 6);
    this.trail = []; this.since = 0;
    this.cs = cell() * SS * rand(0.85, 1.25); this.rad = this.cs * 4; this.ay = 0.7;
    const sh = pick([28, 18, 350, 40, 200]), bh = pick([40, 60, 35, 50]);
    this.sh = sh;
    this.cells = makeCells(ROWS, 5, 4, ch => {
      const n = Math.random();
      if (ch === "S") return [`hsl(${sh},48%,${38 + n * 8}%)`, "rgba(255,255,255,.28)"];
      if (ch === "s") return [`hsl(${sh},50%,${24 + n * 6}%)`, null];
      return [`hsl(${bh},30%,${55 + n * 8}%)`, "rgba(0,0,0,.14)"];
    });
    this.pick();
  }

  get soft() { return this.st === "crawl"; }

  hit(ang, d) { this.react = { delay: d / cfg.wave }; }

  pick() {
    const { W, H } = world;
    this.tx = clamp(this.x + rand(-260, 260), 60, W - 60); this.ty = clamp(this.y + rand(-140, 140), 110, H - 40);
    this.st = "crawl";
  }

  update(dt, t) {
    if (this.react) {
      this.react.delay -= dt;
      if (this.react.delay <= 0) {
        this.react = null;
        if (this.st !== "hide") { this.st = "hide"; this.stage = 0; this.hold = cfg.snail.hide * rand(0.6, 1.6); }
        else this.hold = Math.max(this.hold, cfg.snail.hide * rand(0.5, 1.2));
      }
    }
    const k = dt * 7;
    switch (this.st) {
      case "crawl": {
        this.sk += (1 - this.sk) * k; this.bd += (1 - this.bd) * k;
        const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
        if (d < 5) { this.tm -= dt; if (this.tm <= 0) { this.pick(); this.tm = rand(1, 6); } break; }
        const v = 24 * cfg.snail.pace * cfg.speed * (0.7 + 0.3 * Math.sin(t * 2.4 + this.ph));
        const m = Math.min(d, v * dt);
        this.x += dx / d * m; this.y += dy / d * m;
        if (Math.abs(dx) > 3) this.dir = dx >= 0 ? 1 : -1;
        this.since += m;
        if (this.since > 5) { this.since = 0; this.trail.push({ x: this.x - this.dir * this.cs * 1.6, y: this.y, a: 0 }); }
        break;
      }
      case "hide":                                             // stalks first, then the body, then wait inside
        this.sk = Math.max(0, this.sk - dt * 6); this.bd = Math.max(0, this.bd - dt * (this.sk <= 0 ? 4 : 0));
        if (this.bd <= 0) { this.hold -= dt; if (this.hold <= 0) { this.st = "peek"; this.stage = 0; this.tm = 0; } }
        break;
      case "peek":                                             // one stalk, a look about, then the body
        if (this.stage === 0) { this.sk = Math.min(1, this.sk + dt * 1.6); if (this.sk >= 1) { this.stage = 1; this.tm = rand(0.5, 1.2); } }
        else if (this.stage === 1) { this.tm -= dt; if (this.tm <= 0) this.stage = 2; }
        else { this.bd = Math.min(1, this.bd + dt * 1.2); if (this.bd >= 1) { this.pick(); this.tm = rand(1, 4); } }
        break;
    }
    for (let i = this.trail.length - 1; i >= 0; i--) { const p = this.trail[i]; p.a += dt; if (p.a > cfg.snail.trail) this.trail.splice(i, 1); }
  }

  draw(t) {
    const ctx = world.ctx, cs = this.cs, flip = this.dir < 0 ? -1 : 1, bob = this.st === "crawl" ? Math.sin(t * 2.4 + this.ph) * cs * 0.06 : 0;
    const limit = this.bd * 10.6, sink = (1 - this.bd) * cs * 0.9;
    for (const c of this.cells) {
      const col = c.ox + 5;
      if (c.ch === "B" && col > limit) continue;
      const shell = c.ch === "S" || c.ch === "s";
      paintCell(c, this.x + c.ox * flip * cs, this.y + c.oy * cs + (shell ? sink : 0) + bob, cs, t);
    }
    if (this.sk > 0.05) {                                       // eye stalks
      const base = clamp(limit, 5, HEAD) - 5, len = this.sk * cs * 3.2;
      const bx = this.x + (base + 0.4) * flip * cs, by = this.y - cs * 0.5 + sink * 0.3;
      ctx.strokeStyle = `hsl(40,30%,62%)`; ctx.lineWidth = Math.max(2, cs * 0.28); ctx.lineCap = "round";
      for (const s of [0, 1]) {
        const sw = Math.sin(t * 1.7 + s * 2 + this.ph) * cs * 0.35 * (this.st === "peek" ? 2 : 1);
        const ex = bx + (s * 1.1 - 0.2) * flip * cs + sw * 0.4 + flip * len * 0.18, ey = by - len;
        ctx.beginPath(); ctx.moveTo(bx + s * flip * cs * 0.9, by); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = "#f6f6f2"; ctx.beginPath(); ctx.arc(ex, ey, cs * 0.5, 0, 6.3); ctx.fill();
        pupil(ex + flip * cs * 0.12, ey, cs * 0.22);
      }
    }
  }
}

export default {
  id: "snail", dot: "#e0a86a", theme: "forest", particles: "fireflies",
  density: 1 / 90000, margin: 80, glyphScale: SS,

  init(animals) { list = animals; },
  make: (x, y) => new Snail(x, y),

  /* the shiny trails, under everybody */
  under() {
    const ctx = world.ctx, life = cfg.snail.trail;
    for (const s of list) {
      for (const p of s.trail) {
        const a = 0.34 * (1 - p.a / life);
        if (a <= 0.01) continue;
        ctx.fillStyle = `rgba(190,225,255,${a.toFixed(3)})`;
        ctx.fillRect(p.x - 3, p.y - 1.5, 6, 3);
        ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 1.5);
      }
    }
  }
};
