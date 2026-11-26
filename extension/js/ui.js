/*
 * The settings panel. Everything in it is described by plain lists of items
 * (see TABS), so adding a control is one line: a key from settings.js and a type.
 * Labels come from i18n.js as "s.<key>", hints as "s.<key>.hint", options as "o.<key>.<value>".
 */
import { cfg, get, set, def, on, reset, exportJSON, importJSON, VERSION } from "./settings.js";
import { t, has } from "./i18n.js";
import { world } from "./world.js";
import { SPECIES, GROUPS } from "./animals/index.js";
import { PARTICLE_TYPES } from "./particles.js";
import { THEMES } from "./themes.js";
import { ENGINES } from "./page.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const F = {
  x: v => v.toFixed(1) + "×",
  x2: v => v.toFixed(2) + "×",
  pct: v => Math.round(v * 100) + "%",
  px: v => Math.round(v) + " px",
  s: v => v + " " + t("u.s"),
  n: v => String(v),
  wind: v => (v === 0 ? "0" : (v > 0 ? "→ " : "← ") + Math.abs(v).toFixed(1))
};
const R = (key, min, max, step, fmt, more) => Object.assign({ type: "range", key, min, max, step, fmt }, more);
const T = (key, more) => Object.assign({ type: "toggle", key }, more);
const H = text => ({ type: "head", text });

const SPECIES_ITEMS = {
  penguin: () => [
    R("penguin.tumble", 0, 1.5, 0.05, F.x2), R("penguin.flyers", 0, 1, 0.05, F.pct), R("penguin.dancers", 0, 1, 0.05, F.pct),
    R("penguin.slideEvery", 1, 30, 1, F.s), R("penguin.maxSliders", 0, 8, 1, F.n),
    T("penguin.snowballs", { rerender: true }),
    ...(cfg.penguin.snowballs ? [R("penguin.ballEvery", 2, 30, 1, F.s), R("penguin.ballRange", 150, 1200, 10, F.px), R("penguin.aimError", 0, 150, 5, F.px)] : [])
  ],
  frog: () => [R("frog.kick", 0.1, 1.5, 0.05, F.x2), T("frog.trail")],
  fish: () => [
    { type: "seg", key: "fish.click", opts: ["feed", "scare"], rerender: true },
    ...(cfg.fish.click === "feed" ? [R("fish.food", 1, 15, 1, F.n), R("fish.appetite", 0.4, 2.5, 0.1, F.x)] : []),
    { type: "seg", key: "fish.palette", opts: ["koi", "gold", "tropical"] },
    T("fish.rings")
  ],
  cat: () => [R("cat.lazy", 0, 1, 0.05, F.pct), R("cat.playful", 0.3, 3, 0.1, F.x), R("cat.yarnLife", 3, 30, 1, F.s), T("cat.pet")],
  butterfly: () => [R("butterfly.flutter", 0.4, 2, 0.1, F.x), R("butterfly.flowerLife", 5, 90, 5, F.s), R("butterfly.maxFlowers", 1, 30, 1, F.n)],
  jelly: () => [R("jelly.glow", 0, 1.5, 0.05, F.pct), R("jelly.pulse", 0.4, 2.5, 0.1, F.x), R("jelly.tentacles", 0.4, 2, 0.1, F.x)],
  hedgehog: () => [R("hedgehog.roll", 0.2, 2.5, 0.1, F.x), R("hedgehog.curl", 0.5, 8, 0.5, F.s), T("hedgehog.apples")],
  octopus: () => [R("octopus.ink", 0, 2.5, 0.1, F.x), R("octopus.inkLife", 1, 12, 0.5, F.s), R("octopus.shift", 0, 4, 0.1, F.x)],
  ghost: () => [T("ghost.follow"), R("ghost.opacity", 0.2, 1, 0.05, F.pct), R("ghost.hide", 0.3, 4, 0.1, F.x)],
  crab: () => [R("crab.hide", 0.5, 10, 0.5, F.s), R("crab.claws", 0, 1, 0.05, F.pct)],
  slime: () => [R("slime.merge", 1, 30, 1, F.s), R("slime.bounce", 0.4, 2.5, 0.1, F.x)],
  dino: () => [R("dino.rex", 0, 5, 1, F.n), R("dino.shake", 0, 2.5, 0.1, F.x), R("dino.flee", 0.3, 2.5, 0.1, F.x)],
  squid: () => [R("squid.dark", 0, 0.95, 0.05, F.pct), R("squid.relight", 1, 15, 0.5, F.s), R("squid.glow", 0, 1.5, 0.05, F.pct)],
  mouse: () => [R("mouse.cheese", 3, 10, 1, F.n), R("mouse.holes", 2, 12, 1, F.n), R("mouse.shy", 0.3, 3, 0.1, F.x)],
  bee: () => [R("bee.hives", 1, 5, 1, F.n), R("bee.flowerLife", 5, 90, 5, F.s), R("bee.anger", 1, 20, 1, F.s)],
  spider: () => [R("spider.wait", 0.5, 12, 0.5, F.s), R("spider.sway", 0, 2.5, 0.1, F.x), T("spider.webs")],
  chameleon: () => [R("chameleon.tongue", 120, 800, 10, F.px), R("chameleon.camo", 2, 40, 1, F.s)],
  dog: () => [R("dog.throw", 150, 900, 10, F.px), R("dog.scratch", 0, 1, 0.05, F.pct), R("dog.wag", 0, 2, 0.1, F.x)],
  bat: () => [R("bat.fly", 2, 20, 1, F.s), R("bat.flap", 0.5, 2, 0.1, F.x), R("bat.insomnia", 0, 1, 0.05, F.pct)],
  snail: () => [R("snail.pace", 0.3, 3, 0.1, F.x), R("snail.trail", 3, 60, 1, F.s), R("snail.hide", 1, 12, 0.5, F.s)],
  owl: () => [R("owl.turn", 0, 1, 0.05, F.pct), R("owl.blink", 0.2, 3, 0.1, F.x), T("owl.hoot")],
  duck: () => [R("duck.chicks", 2, 8, 1, F.n), R("duck.scatter", 1, 8, 0.5, F.s), T("duck.quack"), T("duck.wake")],
  snake: () => [R("snake.pace", 0.4, 3, 0.1, F.x), R("snake.grow", 1, 8, 1, F.n), R("snake.max", 12, 200, 2, F.n)],
  ufo: () => [R("ufo.saucers", 1, 5, 1, F.n), R("ufo.lift", 0.4, 2.5, 0.1, F.x)]
};

/* the animal picker: one block of chips per group, in the same order as the page switcher */
const animalPicker = () => {
  const chip = s => ({ v: s.id, dot: s.dot, label: t("a." + s.id) });
  const out = [];
  for (const g of GROUPS) {
    out.push(H(t("g." + g.id)));
    out.push({ type: "chips", key: "animal", cols: 3, rerender: true, opts: g.ids.map(id => SPECIES.find(s => s.id === id)).filter(Boolean).map(chip) });
  }
  out.push(H(t("g.other")));
  out.push({ type: "chips", key: "animal", cols: 3, rerender: true, opts: [{ v: "random", label: t("a.random") }] });
  return out;
};

const TABS = [
  { id: "animals", items: () => [
    ...animalPicker(),
    { type: "note", text: t("a." + world.species + ".hint") },
    T("switcher"),
    H(t("h.everyone")),
    R("count", 0.2, 3, 0.1, F.x), R("size", 0.6, 2, 0.05, F.x2), R("speed", 0.3, 2.5, 0.1, F.x),
    ...(world.species === "penguin" || world.species === "frog" ? [T("hats")] : []),
    H(t("a." + world.species)),
    ...SPECIES_ITEMS[world.species](),
    H(t("h.click")),
    R("reach", 50, 1600, 25, F.px), R("wave", 400, 3000, 50, v => Math.round(v) + " px/" + t("u.s")),
    T("confetti"), T("ripple")
  ] },
  { id: "particles", items: () => [
    { type: "chips", key: "particles.type", cols: 3, rerender: true, opts: PARTICLE_TYPES.map(v => ({ v, label: t("p." + v) })) },
    ...(cfg.particles.type === "auto" ? [{ type: "note", text: t("p.auto.hint") }] : []),
    ...(cfg.particles.type === "none" ? [] : [
      R("particles.amount", 0, 500, 10, F.n), R("particles.speed", 0.2, 3, 0.1, F.x), R("particles.size", 0.5, 2.5, 0.1, F.x),
      R("particles.wind", -1, 1, 0.1, F.wind), R("particles.opacity", 0.1, 1, 0.05, F.pct),
      T("particles.react")
    ]),
    ...(cfg.particles.type === "custom" ? [
      H(t("h.custom")),
      { type: "text", key: "particles.custom", max: 40 }, { type: "color", key: "particles.color" }, T("particles.rise")
    ] : [])
  ] },
  { id: "text", items: () => {
    const m = cfg.title.mode, sub = cfg.title.sub, uses = k => m === k || sub === k;
    return [
      { type: "select", key: "title.mode", opts: ["newyear", "greeting", "clock", "date", "countdown", "custom", "none"], rerender: true },
      ...(m === "custom" ? [{ type: "text", key: "title.text", max: 80 }] : []),
      ...(m === "countdown" ? [{ type: "text", key: "title.event", max: 40 }, { type: "date", key: "title.date" }] : []),
      { type: "select", key: "title.sub", opts: ["none", "clock", "date", "greeting"], rerender: true },
      ...(uses("greeting") ? [{ type: "text", key: "title.name", max: 30 }] : []),
      ...(uses("clock") ? [T("title.h24"), T("title.seconds")] : []),
      H(t("h.style")),
      R("title.size", 0.5, 2.5, 0.05, F.x2),
      { type: "seg", key: "title.font", opts: ["sans", "serif", "mono"] },
      { type: "color", key: "title.color" }, T("title.glow")
    ];
  } },
  { id: "search", items: () => [
    T("search.show", { rerender: true }),
    ...(cfg.search.show ? [
      { type: "select", key: "search.engine", rerender: true,
        opts: ["default", ...Object.keys(ENGINES), "custom"], label: v => (ENGINES[v] ? ENGINES[v][0] : t("o.search.engine." + v)) },
      ...(cfg.search.engine === "custom" ? [{ type: "text", key: "search.custom", max: 300, mono: true }] : []),
      T("search.newTab"), R("search.width", 360, 1100, 10, F.px)
    ] : [])
  ] },
  { id: "look", items: () => [
    { type: "chips", key: "theme", cols: 5, rerender: true,
      opts: ["auto", ...Object.keys(THEMES), "custom"].map(v => ({ v, label: t("o.theme." + v), swatch: THEMES[v] ? THEMES[v].bg2 : null })) },
    ...(cfg.theme === "custom" ? [{ type: "color", key: "bg" }] : []),
    H(t("h.grid")),
    T("grid", { rerender: true }),
    ...(cfg.grid ? [R("gridAlpha", 0.01, 0.25, 0.005, F.pct)] : []),
    T("vignette"),
    H(t("h.cells")),
    T("glyphs", { rerender: true }),
    ...(cfg.glyphs ? [{ type: "text", key: "glyphSet", max: 24, mono: true }] : []),
    T("shadows")
  ] },
  { id: "system", items: () => [
    { type: "seg", key: "lang", opts: ["auto", "en", "ru"] },
    H(t("h.perf")),
    { type: "seg", key: "fps", opts: [15, 30, 60, 0], label: v => (v ? String(v) : t("o.fps.0")) },
    T("showFps"),
    { type: "seg", key: "quality", opts: ["low", "medium", "high", "ultra"] },
    H(t("h.data")),
    { type: "data" },
    { type: "note", text: "Critter Tab " + VERSION }
  ] }
];

let active = "animals";

/* ── controls ────────────────────────────────────────────────────── */
const label = it => t("s." + it.key);
const optLabel = (it, v) => (it.label ? it.label(v) : t("o." + it.key + "." + v));
const hint = (row, it) => { if (has("s." + it.key + ".hint")) row.append(el("div", "hint", t("s." + it.key + ".hint"))); };
const changed = it => { if (it.rerender) renderBody(); };

const make = {
  head: it => el("h3", "head", it.text),
  note: it => el("p", "note", it.text),

  range(it) {
    const row = el("label", "row"), top = el("div", "row-top"), out = el("output", "val"), inp = el("input");
    inp.type = "range"; inp.min = it.min; inp.max = it.max; inp.step = it.step; inp.value = get(it.key);
    const paint = () => {
      const v = +inp.value;
      out.textContent = (it.fmt || F.n)(v);
      inp.style.setProperty("--p", (v - it.min) / (it.max - it.min) * 100 + "%");
    };
    inp.addEventListener("input", () => { set(it.key, +inp.value); paint(); });
    out.title = t("ui.dbl");
    out.addEventListener("dblclick", e => { e.preventDefault(); inp.value = def(it.key); set(it.key, +inp.value); paint(); });
    top.append(el("span", "lab", label(it)), out);
    row.append(top, inp); hint(row, it); paint();
    return row;
  },

  toggle(it) {
    const row = el("label", "row row-line"), inp = el("input", "switch");
    inp.type = "checkbox"; inp.checked = get(it.key);
    inp.addEventListener("change", () => { set(it.key, inp.checked); changed(it); });
    const text = el("span", "lab", label(it));
    if (has("s." + it.key + ".hint")) text.append(el("small", "hint", t("s." + it.key + ".hint")));
    row.append(text, inp);
    return row;
  },

  seg(it) {
    const row = el("div", "row"), box = el("div", "seg");
    row.append(el("span", "lab", label(it)), box);
    for (const v of it.opts) {
      const b = el("button", "", optLabel(it, v));
      b.type = "button"; b.setAttribute("aria-pressed", String(get(it.key) === v));
      b.addEventListener("click", () => {
        set(it.key, v);
        for (const o of box.children) o.setAttribute("aria-pressed", String(o === b));
        changed(it);
      });
      box.append(b);
    }
    hint(row, it);
    return row;
  },

  chips(it) {
    const box = el("div", "chips");
    box.style.setProperty("--cols", it.cols || 3);
    for (const o of it.opts) {
      const b = el("button");
      b.type = "button"; b.setAttribute("aria-pressed", String(get(it.key) === o.v));
      if (o.dot) { const i = el("i", "dot"); i.style.background = o.dot; b.append(i); }
      if (o.swatch) { const i = el("i", "swatch"); i.style.background = o.swatch; b.append(i); }
      b.append(o.label);
      b.addEventListener("click", () => {
        set(it.key, o.v);
        for (const c of box.children) c.setAttribute("aria-pressed", String(c === b));
        changed(it);
      });
      box.append(b);
    }
    return box;
  },

  select(it) {
    const row = el("label", "row"), line = el("div", "row-line"), sel = el("select");
    for (const v of it.opts) { const o = el("option", "", optLabel(it, v)); o.value = v; sel.append(o); }
    sel.value = get(it.key);
    sel.addEventListener("change", () => { set(it.key, sel.value); changed(it); });
    line.append(el("span", "lab", label(it)), sel);
    row.append(line); hint(row, it);
    return row;
  },

  text(it) {
    const row = el("label", "row"), inp = el("input", it.mono ? "mono" : "");
    inp.type = "text"; inp.value = get(it.key); inp.maxLength = it.max || 100; inp.spellcheck = false;
    inp.addEventListener("input", () => set(it.key, inp.value));
    row.append(el("span", "lab", label(it)), inp); hint(row, it);
    return row;
  },

  date(it) {
    const row = el("label", "row row-line"), inp = el("input");
    inp.type = "date"; inp.value = get(it.key);
    inp.addEventListener("input", () => set(it.key, inp.value));
    row.append(el("span", "lab", label(it)), inp);
    return row;
  },

  color(it) {
    const row = el("label", "row row-line"), inp = el("input");
    inp.type = "color"; inp.value = get(it.key);
    inp.addEventListener("input", () => set(it.key, inp.value));
    row.append(el("span", "lab", label(it)), inp);
    return row;
  },

  data() {
    const row = el("div", "row"), box = el("div", "btns");
    const exp = el("button", "btn", t("b.export")), imp = el("button", "btn", t("b.import")), rst = el("button", "btn danger", t("b.reset"));
    const file = el("input"); file.type = "file"; file.accept = "application/json,.json"; file.hidden = true;
    for (const b of [exp, imp, rst]) b.type = "button";
    exp.addEventListener("click", () => {
      const a = el("a");
      a.href = URL.createObjectURL(new Blob([exportJSON()], { type: "application/json" }));
      a.download = "critter-tab-settings.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    imp.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files[0]; file.value = "";
      if (!f) return;
      try { importJSON(await f.text()); } catch (e) { alert(t("m.importBad")); }
    });
    rst.addEventListener("click", () => { if (confirm(t("m.reset"))) reset(); });
    box.append(exp, imp, rst, file);
    row.append(box, el("div", "hint", t("m.data")));
    return row;
  }
};

/* ── panel ───────────────────────────────────────────────────────── */
function renderBody() {
  const body = $("panel-body"), top = body.scrollTop;
  body.textContent = "";
  const tab = TABS.find(x => x.id === active) || TABS[0];
  for (const it of tab.items()) body.append(make[it.type](it));
  body.scrollTop = top;
}

function renderTabs() {
  const bar = $("panel-tabs");
  bar.textContent = "";
  for (const tab of TABS) {
    const b = el("button", "", t("tab." + tab.id));
    b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(tab.id === active));
    b.addEventListener("click", () => { active = tab.id; $("panel-body").scrollTop = 0; renderTabs(); renderBody(); });
    bar.append(b);
  }
}

function open(yes) {
  const panel = $("panel"), gear = $("gear");
  panel.classList.toggle("open", yes);
  panel.setAttribute("aria-hidden", String(!yes));
  panel.inert = !yes;
  gear.setAttribute("aria-expanded", String(yes));
  document.documentElement.classList.toggle("panel-open", yes);
  if (yes) { renderTabs(); renderBody(); }
}

/* the settings button can be switched off from the toolbar popup */
function applyGear() {
  const gear = $("gear");
  gear.hidden = !cfg.gear;
  if (!cfg.gear && $("panel").classList.contains("open")) open(false);
}

export function initUI() {
  const panel = $("panel");
  panel.inert = true;
  applyGear();
  $("gear").title = t("ui.settings");
  $("gear").addEventListener("click", () => open(!panel.classList.contains("open")));
  $("panel-close").addEventListener("click", () => open(false));
  window.addEventListener("keydown", e => { if (e.key === "Escape" && panel.classList.contains("open")) open(false); });
  /* some changes alter what the panel itself should show */
  on(key => {
    if (key === "gear" || key === "*") applyGear();
    if (!panel.classList.contains("open")) return;
    if (key === "*" || key === "lang") { $("gear").title = t("ui.settings"); renderTabs(); renderBody(); }
    else if (key === "animal" && active === "animals") renderBody();
  });
}
