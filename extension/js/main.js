/*
 * Critter Tab: animals made of ASCII cells that live on your new tab and react to clicks.
 * No network, no dependencies. This file owns the canvas, the loop and the click.
 */
import { cfg, load, on } from "./settings.js";
import { world, rand, pick, cell, TAU, MONO, CONFETTI_COLORS, syncGlyphs, spark } from "./world.js";
import { SPECIES, byId } from "./animals/index.js";
import * as particles from "./particles.js";
import { themeColors } from "./themes.js";
import { initPage, refreshPage, markSwitcher, renderTitle } from "./page.js";
import { initUI } from "./ui.js";

load();

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: false });
world.ctx = ctx;

const animals = [];
let species = null, bg = null;
const lucky = pick(SPECIES).id;                    // what "random" means in this tab
const activeId = () => (byId(cfg.animal) ? cfg.animal : lucky);

/* ── world ───────────────────────────────────────────────────────── */
function pixelRatio() {
  const d = window.devicePixelRatio || 1;
  switch (cfg.quality) {
    case "low": return 0.6;
    case "medium": return 1;
    case "ultra": return Math.min(d, 3);
    default: return Math.min(d, 2);
  }
}

function buildBg() {
  const { W, H, dpr } = world, th = themeColors(species);
  bg = document.createElement("canvas");
  bg.width = canvas.width; bg.height = canvas.height;
  const g = bg.getContext("2d");
  g.scale(dpr, dpr);
  g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
  if (cfg.vignette) {
    const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    gr.addColorStop(0, th.bg2); gr.addColorStop(1, th.bg);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  if (cfg.grid) {
    g.strokeStyle = `rgba(255,255,255,${cfg.gridAlpha})`; g.lineWidth = 1;
    const step = cell() * 1.05;
    g.beginPath();
    for (let x = 0; x <= W; x += step) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, H); }
    for (let y = 0; y <= H; y += step) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(W, Math.round(y) + 0.5); }
    g.stroke();
  }
  document.body.style.background = th.bg;
}

/* add or remove animals until there are as many as the settings ask for */
function fill() {
  const { W, H } = world, m = species.margin;
  const want = Math.max(1, Math.round(W * H * species.density * cfg.count));
  while (animals.length < want) animals.push(species.make(rand(m, Math.max(m + 1, W - m)), rand(m, Math.max(m + 1, H - m))));
  animals.length = want;
  for (const a of animals) { a.x = Math.min(W - 20, a.x); a.y = Math.min(H - 20, a.y); }
}

/* rebuild every animal where it stands (size, hats or colours changed) */
function respawn() {
  const spots = animals.map(a => [a.x, a.y]);
  animals.length = 0;
  species.init(animals);
  for (const [x, y] of spots) animals.push(species.make(x, y));
  fill();
}

function setSpecies() {
  species = byId(activeId());
  world.species = species.id;
  animals.length = 0; world.sparks.length = 0; world.ripples.length = 0; world.shake = 0;
  species.init(animals);
  fill(); buildBg(); particles.rebuild(species);
  document.documentElement.style.setProperty("--accent", species.dot);
  markSwitcher();
}

function resize() {
  const dpr = world.dpr = pixelRatio();
  const W = world.W = window.innerWidth, H = world.H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  buildBg(); fill(); particles.rebuild(species);
}

/* ── settings that need more than "read it next frame" ───────────── */
const RESPAWN = new Set(["size", "hats", "fish.palette", "jelly.tentacles", "penguin.flyers", "penguin.dancers", "dino.rex", "mouse.holes", "duck.chicks", "ufo.saucers"]);
const BACKDROP = new Set(["theme", "bg", "grid", "gridAlpha", "vignette"]);
const LIVE_PARTICLES = new Set(["particles.speed", "particles.wind", "particles.opacity", "particles.react"]);
const fpsBox = document.getElementById("fps");

on(key => {
  if (key === "*") { syncGlyphs(); setSpecies(); resize(); refreshPage(); fpsBox.hidden = !cfg.showFps; return; }
  if (key === "animal") return setSpecies();
  if (RESPAWN.has(key)) { respawn(); if (key === "size") buildBg(); return; }
  if (key === "count") return fill();
  if (BACKDROP.has(key)) return buildBg();
  if (key === "quality") return resize();
  if (key === "glyphs" || key === "glyphSet") return syncGlyphs();
  if (key === "showFps") { fpsBox.hidden = !cfg.showFps; return; }
  if (key === "particles.type" || key === "particles.amount") return particles.rebuild(species);
  if (key.startsWith("particles.")) { if (!LIVE_PARTICLES.has(key)) particles.restyle(); return; }
  if (key === "switcher") return markSwitcher();
  if (key === "lang" || key.startsWith("title.") || key.startsWith("search.")) return refreshPage();
});

/* ── the click ───────────────────────────────────────────────────── */
function poke(x, y, alt) {
  particles.blow(x, y);
  /* an animal may have its own idea of what a click is (food, yarn, flowers); a right-click is always the shove */
  if (!alt && species.poke && species.poke(x, y)) return;
  if (cfg.ripple) world.ripples.push({ x, y, t: 0 });
  for (const a of animals) {
    const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy);
    if (d > cfg.reach) continue;
    a.hit(Math.atan2(dy, dx), d, 1 - d / cfg.reach);
  }
  if (cfg.confetti) {
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), v = rand(120, 380);
      spark({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, life: rand(0.7, 1.4), ch: "*+.#%"[Math.floor(Math.random() * 5)], c: pick(CONFETTI_COLORS) });
    }
  }
}
const onUi = e => e.target.closest && e.target.closest("form, nav, .panel, .gear, .menu");
window.addEventListener("pointerdown", e => { if (e.button === 0 && !onUi(e)) poke(e.clientX, e.clientY, false); });
window.addEventListener("contextmenu", e => { if (onUi(e)) return; e.preventDefault(); poke(e.clientX, e.clientY, true); });
window.addEventListener("pointermove", e => { world.mouse.x = e.clientX; world.mouse.y = e.clientY; world.mouse.on = true; });
document.documentElement.addEventListener("pointerleave", () => { world.mouse.on = false; });
window.addEventListener("resize", resize);

/* ── loop ────────────────────────────────────────────────────────── */
let last = performance.now(), due = last, fpsN = 0, fpsT = last;

function frame(now) {
  requestAnimationFrame(frame);
  /* frame-rate cap: skip this screen refresh if the next frame is not due yet */
  if (cfg.fps > 0) {
    const gap = 1000 / cfg.fps;
    if (now - due < gap - 1.5) return;
    due += gap; if (now - due > gap) due = now;
  }
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, { W, H, dpr, sparks, ripples } = world;

  if (cfg.showFps) {
    fpsN++;
    if (now - fpsT >= 500) { fpsBox.textContent = Math.round(fpsN * 1000 / (now - fpsT)) + " fps"; fpsN = 0; fpsT = now; }
  }

  for (const a of animals) a.update(dt, t);
  if (species.update) species.update(dt, t);

  /* animals that are just standing about nudge each other apart */
  if (species.separate !== false) {
    const slide = Math.min(1, dt * 6);
    for (let i = 0; i < animals.length; i++) {
      for (let j = i + 1; j < animals.length; j++) {
        const a = animals[i], b = animals[j], minD = a.rad + b.rad, ay = (a.ay + b.ay) / 2;
        const dx = b.x - a.x, dy = (b.y - a.y) * ay, d = Math.hypot(dx, dy);
        if (d >= minD || d < 0.01) continue;
        const push = (minD - d) * 0.5 * slide / d;
        if (a.soft) { a.x -= dx * push; a.y -= dy * push / ay; }
        if (b.soft) { b.x += dx * push; b.y += dy * push / ay; }
      }
    }
  }

  particles.update(dt, t);
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i]; p.age += dt;
    if (p.age > p.life) { sparks.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.5, dt);
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].t += dt;
    if (ripples[i].t * cfg.wave > cfg.reach + 80) ripples.splice(i, 1);
  }

  /* draw */
  let jx = 0, jy = 0;                                        // screen shake
  if (world.shake > 0.02) { jx = rand(-1, 1) * world.shake * 7; jy = rand(-1, 1) * world.shake * 7; world.shake *= Math.pow(0.03, dt); } else world.shake = 0;
  ctx.setTransform(dpr, 0, 0, dpr, jx * dpr, jy * dpr);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(bg, -10, -10, W + 20, H + 20);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cs = cell();

  particles.drawUnder(t);
  ctx.font = `${Math.round(cs * 0.9)}px ${MONO}`;
  if (species.under) species.under(t);
  for (const r of ripples) {
    const R = r.t * cfg.wave;
    const a = Math.max(0, 1 - R / (cfg.reach + 80)) * 0.5;
    ctx.fillStyle = `rgba(190,230,255,${a.toFixed(3)})`;
    const n = Math.max(16, Math.floor(R * TAU / 15));
    for (let i = 0; i < n; i++) { const an = i / n * TAU; ctx.fillText("·", r.x + Math.cos(an) * R, r.y + Math.sin(an) * R); }
  }

  animals.sort((a, b) => a.y - b.y);
  if (cfg.shadows) for (const a of animals) if (a.shadow) a.shadow();
  ctx.font = `${Math.max(4, Math.round(cs * 0.62 * species.glyphScale))}px ${MONO}`;
  for (const a of animals) a.draw(t);
  if (species.over) species.over(t);

  particles.drawOver(t);
  ctx.font = `15px ${MONO}`;
  for (const p of sparks) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.c; ctx.fillText(p.ch, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

/* ── go ──────────────────────────────────────────────────────────── */
syncGlyphs();
species = byId(activeId());
world.species = species.id;
initPage();
resize();
setSpecies();
initUI();
fpsBox.hidden = !cfg.showFps;
renderTitle();
requestAnimationFrame(frame);
