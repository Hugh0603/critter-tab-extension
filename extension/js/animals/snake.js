/*
 * The snake from the old phone game: one long snake crawls over the grid in right angles,
 * wrapping round the edges. Click: an apple appears there. The snake heads for it,
 * eats it and grows a little longer. Right-click makes it dash.
 */
import { cfg } from "../settings.js";
import { world, rand, pick, cell, TAU, paintCell, spark } from "../world.js";

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const SN = 2.1;                                                // two squares of the background grid

let list = [];
const apples = [];

class Snake {
  constructor(x, y) {
    const g = this.g = cell() * SN;
    this.cols = Math.max(8, Math.floor(world.W / g)); this.rows = Math.max(6, Math.floor(world.H / g));
    const cx = Math.floor(clamp(x / g, 6, this.cols - 7)), cy = Math.floor(clamp(y / g, 3, this.rows - 4));
    this.dir = Math.floor(Math.random() * 4); this.body = []; this.prev = [];
    for (let i = 0; i < 10; i++) this.body.push([cx - DIRS[this.dir][0] * i, cy - DIRS[this.dir][1] * i]);
    this.prev = this.body.map(p => p.slice());
    this.grow = 0; this.acc = 0; this.u = 0; this.runLen = 5; this.dash = 0; this.react = null; this.lastTurn = 0;
    this.hue = pick([120, 135, 95, 160]);
    this.x = x; this.y = y; this.rad = 0; this.ay = 1; this.tongue = 0;
  }

  get soft() { return false; }

  hit(ang, d) { this.react = { delay: d / cfg.wave }; }

  free(c, r, skipTail) {
    const n = this.body.length - (skipTail ? 1 : 0);
    for (let i = 0; i < n; i++) if (this.body[i][0] === c && this.body[i][1] === r) return false;
    return true;
  }

  wrap(c, r) { return [(c + this.cols) % this.cols, (r + this.rows) % this.rows]; }

  /* pick the next direction: towards the nearest apple if there is one, otherwise a lazy wander */
  steer() {
    const [hc, hr] = this.body[0], back = (this.dir + 2) % 4;
    const target = apples.length ? apples.reduce((b, a) => (Math.abs(a.c - hc) + Math.abs(a.r - hr) < Math.abs(b.c - hc) + Math.abs(b.r - hr) ? a : b)) : null;
    const options = [];
    for (let d = 0; d < 4; d++) {
      if (d === back) continue;
      const [c, r] = this.wrap(hc + DIRS[d][0], hr + DIRS[d][1]);
      if (!this.free(c, r, this.grow <= 0)) continue;
      let score = d === this.dir && !target ? 0.6 : 0;
      if (target) score += 4 - (Math.abs(target.c - c) + Math.abs(target.r - r)) / Math.max(1, Math.abs(target.c - hc) + Math.abs(target.r - hr) + 1) * 2;
      else if (d !== this.dir && Math.random() < 0.5) score += 0.2;
      /* do not walk into a dead end: count the room two steps ahead */
      const [c2, r2] = this.wrap(c + DIRS[d][0], r + DIRS[d][1]);
      if (!this.free(c2, r2, true)) score -= 3;
      options.push([score + Math.random() * (target ? 0.05 : 0.5), d]);
    }
    if (!options.length) { this.body.length = Math.max(5, Math.floor(this.body.length / 2)); this.prev.length = this.body.length; return this.dir; }
    options.sort((a, b) => b[0] - a[0]);
    if (!target) {                                             // wandering: a straight run, then a turn
      const straight = options.some(o => o[1] === this.dir);
      if (straight && this.lastTurn < this.runLen) return this.dir;
      this.runLen = Math.floor(rand(3, 10));
      const turns = options.filter(o => o[1] !== this.dir);
      if (turns.length) return turns[Math.floor(Math.random() * turns.length)][1];
    }
    return options[0][1];
  }

  step() {
    this.dir = this.steer();
    const [hc, hr] = this.body[0], [c, r] = this.wrap(hc + DIRS[this.dir][0], hr + DIRS[this.dir][1]);
    this.lastTurn = this.dir === this.lastDir ? this.lastTurn + 1 : 0; this.lastDir = this.dir;
    this.prev = this.body.map(p => p.slice());
    if (this.grow > 0) { this.grow--; this.prev.push(this.prev[this.prev.length - 1].slice()); }
    else this.body.pop();
    this.body.unshift([c, r]);
    if (this.body.length > this.prev.length) this.prev.length = this.body.length;
    for (let i = 0; i < this.body.length; i++) if (!this.prev[i]) this.prev[i] = this.prev[i - 1].slice();
    for (let i = apples.length - 1; i >= 0; i--) {
      const a = apples[i];
      if (a.c === c && a.r === r) {
        apples.splice(i, 1);
        if (this.body.length < cfg.snake.max) this.grow += cfg.snake.grow;
        const px = (c + 0.5) * this.g, py = (r + 0.5) * this.g;
        for (let k = 0; k < 10; k++) spark({ x: px, y: py, vx: rand(-140, 140), vy: rand(-170, -30), life: 0.6, ch: pick(["*", "+", "o"]), c: "#ff8a8a" });
        spark({ x: px, y: py - 18, vx: 0, vy: -40, g: 0, life: 0.8, ch: "+" + cfg.snake.grow, c: "#9dff9a" });
      }
    }
  }

  update(dt) {
    if (this.react) { this.react.delay -= dt; if (this.react.delay <= 0) { this.react = null; this.dash = 1.6; } }
    if (this.dash > 0) this.dash -= dt;
    const period = 0.13 / (cfg.snake.pace * cfg.speed * (this.dash > 0 ? 2.6 : 1));
    this.acc += dt;
    let n = 0;
    while (this.acc >= period && n++ < 6) { this.acc -= period; this.step(); }
    if (this.acc > period) this.acc = 0;
    this.u = this.acc / period;
    this.tongue += dt;
    this.x = (this.body[0][0] + 0.5) * this.g; this.y = (this.body[0][1] + 0.5) * this.g;
  }

  draw(t) {
    const ctx = world.ctx, g = this.g, len = this.body.length, u = Math.min(1, this.u);
    const pos = (i) => {                                       // between where it was and where it is now, without crossing the screen on a wrap
      const a = this.prev[i] || this.body[i], b = this.body[i];
      let dc = b[0] - a[0], dr = b[1] - a[1];
      if (Math.abs(dc) > 1 || Math.abs(dr) > 1) return [(b[0] + 0.5) * g, (b[1] + 0.5) * g];
      return [(a[0] + dc * u + 0.5) * g, (a[1] + dr * u + 0.5) * g];
    };
    for (let i = len - 1; i >= 0; i--) {
      const [px, py] = pos(i), k = i / Math.max(1, len - 1), sz = g * (i === 0 ? 1.04 : 0.98 - k * 0.16);
      const stripe = (i >> 1) % 2 ? 7 : 0;
      const seg = { fill: i === 0 ? `hsl(${this.hue},62%,42%)` : `hsl(${this.hue},${50 - k * 10}%,${30 + stripe - k * 8}%)`, gc: "rgba(220,255,200,.3)", ph: i * 0.37 };
      paintCell(seg, px, py, sz, t);
    }
    /* the head: eyes and a flicking tongue, turned the way it is going */
    const [hx, hy] = pos(0), [dx, dy] = DIRS[this.dir], sx = -dy, sy = dx;
    ctx.fillStyle = "#fff6c8";
    for (const s of [-1, 1]) {
      const ex = hx + dx * g * 0.12 + sx * s * g * 0.26, ey = hy + dy * g * 0.12 + sy * s * g * 0.26;
      ctx.beginPath(); ctx.arc(ex, ey, g * 0.17, 0, TAU); ctx.fill();
      ctx.fillStyle = "#0a0a0a"; ctx.beginPath(); ctx.arc(ex + dx * g * 0.05, ey + dy * g * 0.05, g * 0.08, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff6c8";
    }
    if (Math.sin(this.tongue * 9) > 0.1) {
      const tx = hx + dx * g * 0.55, ty = hy + dy * g * 0.55;
      ctx.strokeStyle = "#ff4d63"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + dx * g * 0.45, ty + dy * g * 0.45);
      ctx.moveTo(tx + dx * g * 0.45, ty + dy * g * 0.45); ctx.lineTo(tx + dx * g * 0.7 + sx * g * 0.15, ty + dy * g * 0.7 + sy * g * 0.15);
      ctx.moveTo(tx + dx * g * 0.45, ty + dy * g * 0.45); ctx.lineTo(tx + dx * g * 0.7 - sx * g * 0.15, ty + dy * g * 0.7 - sy * g * 0.15);
      ctx.stroke();
    }
  }
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default {
  id: "snake", dot: "#6fe06a", theme: "mono", particles: "none",
  density: 1 / 40000000, margin: 40, glyphScale: SN, separate: false,

  init(animals) { list = animals; apples.length = 0; },
  make: (x, y) => new Snake(x, y),

  poke(x, y) {
    const g = list.length ? list[0].g : cell() * SN;
    if (apples.length >= 4) apples.shift();
    apples.push({ c: Math.floor(x / g), r: Math.floor(y / g), g });
    return true;
  },

  under(t) {
    const ctx = world.ctx;
    for (const a of apples) {
      const g = a.g, px = (a.c + 0.5) * g, py = (a.r + 0.5) * g, pulse = 1 + Math.sin(t * 6 + a.c) * 0.06;
      ctx.fillStyle = "#e63946"; ctx.beginPath(); ctx.arc(px, py + g * 0.04, g * 0.42 * pulse, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(px - g * 0.2, py - g * 0.18, g * 0.12, g * 0.2);
      ctx.strokeStyle = "#4a2c14"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py - g * 0.35); ctx.lineTo(px + g * 0.06, py - g * 0.55); ctx.stroke();
      ctx.fillStyle = "#5fd35f"; ctx.beginPath(); ctx.ellipse(px + g * 0.2, py - g * 0.5, g * 0.18, g * 0.09, -0.4, 0, TAU); ctx.fill();
    }
  }
};
