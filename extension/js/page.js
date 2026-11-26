/* The page on top of the pond: the title, the search box and the animal switcher. */
import { cfg, set } from "./settings.js";
import { t, lang } from "./i18n.js";
import { world } from "./world.js";
import { SPECIES, GROUPS } from "./animals/index.js";

export const ENGINES = {
  google: ["Google", "https://www.google.com/search?q=%s"],
  duckduckgo: ["DuckDuckGo", "https://duckduckgo.com/?q=%s"],
  bing: ["Bing", "https://www.bing.com/search?q=%s"],
  brave: ["Brave", "https://search.brave.com/search?q=%s"],
  ecosia: ["Ecosia", "https://www.ecosia.org/search?q=%s"],
  startpage: ["Startpage", "https://www.startpage.com/sp/search?query=%s"],
  yandex: ["Yandex", "https://yandex.com/search/?text=%s"]
};
const FONTS = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Menlo, Consolas, monospace'
};

const $ = id => document.getElementById(id);
const root = document.documentElement;

/* ── title ───────────────────────────────────────────────────────── */
const locale = () => (lang() === "ru" ? "ru-RU" : "en-US");

function greeting() {
  const h = new Date().getHours();
  const g = t(h >= 5 && h < 12 ? "title.morning" : h < 18 ? "title.afternoon" : h < 23 ? "title.evening" : "title.night");
  const name = cfg.title.name.trim();
  return name ? `${g}, ${name}` : g;
}
const clock = () => new Date().toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit", second: cfg.title.seconds ? "2-digit" : undefined, hour12: !cfg.title.h24 });
const today = () => {
  const s = new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function newYear() {
  const now = new Date(), m = now.getMonth(), d = now.getDate(), ru = lang() === "ru";
  if (m === 0 && (ru ? d === 7 : false)) return t("title.xmas");
  if (m === 0 && d <= 7) return t("title.ny", { year: now.getFullYear() });
  if (!ru && m === 11 && d >= 24 && d <= 26) return t("title.xmas");
  const next = now.getFullYear() + 1;
  const n = Math.ceil((new Date(next, 0, 1) - now) / 864e5);
  return t("title.until", { n, days: t("title.days", n), what: next });
}

function countdown() {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cfg.title.date);
  if (!m) return t("title.pickDate");
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - start) / 864e5);
  const event = cfg.title.event.trim(), a = Math.abs(n), vars = { event, n: a, days: t("title.days", a) };
  if (n === 0) return t(event ? "title.today" : "title.todayBare", vars);
  if (n > 0) return t(event ? "title.in" : "title.left", vars);
  return t(event ? "title.ago" : "title.agoBare", vars);
}

function titleText(mode) {
  switch (mode) {
    case "newyear": return newYear();
    case "greeting": return greeting();
    case "clock": return clock();
    case "date": return today();
    case "countdown": return countdown();
    case "custom": return cfg.title.text;
    default: return "";
  }
}

function renderTitle() {
  const h1 = $("title"), sub = $("sub"), T = cfg.title;
  const text = titleText(T.mode);
  if (h1.textContent !== text) h1.textContent = text;
  h1.hidden = !text;
  const s = T.sub === "none" ? "" : titleText(T.sub);
  if (sub.textContent !== s) sub.textContent = s;
  sub.hidden = !s;
}

/* ── search ──────────────────────────────────────────────────────── */
const asUrl = q => {
  if (/^https?:\/\/\S+$/i.test(q)) return q;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(q)) return "https://" + q;
  return null;
};
const go = url => { if (cfg.search.newTab) window.open(url, "_blank", "noopener"); else location.href = url; };

function onSearch(e) {
  e.preventDefault();
  const q = $("q").value.trim();
  if (!q) return;
  const url = asUrl(q);
  if (url) return go(url);
  const eng = cfg.search.engine;
  const api = typeof chrome !== "undefined" && chrome.search && chrome.search.query;
  if (eng === "default" && api) {                              // whatever the browser is set to
    chrome.search.query({ text: q, disposition: cfg.search.newTab ? "NEW_TAB" : "CURRENT_TAB" });
    return;
  }
  let tpl = eng === "custom" ? cfg.search.custom.trim() : (ENGINES[eng] || ENGINES.google)[1];
  if (!/^https?:\/\//i.test(tpl)) tpl = ENGINES.google[1];
  go(tpl.includes("%s") ? tpl.replace("%s", encodeURIComponent(q)) : tpl + encodeURIComponent(q));
}

function renderSearch() {
  const S = cfg.search, form = $("search");
  form.hidden = !S.show;
  const name = ENGINES[S.engine] && ENGINES[S.engine][0];
  $("q").placeholder = name ? t("search.ph", { engine: name }) : S.engine === "custom" ? t("search.custom") : t("search.web");
  root.style.setProperty("--search-w", S.width + "px");
}

/* ── animal switcher ─────────────────────────────────────────────── */
/* one pill per group; a click opens a small menu under it with that group's animals */
let openId = null;
const menu = () => $("groupmenu");
const dotOf = id => (SPECIES.find(s => s.id === id) || {}).dot || "#fff";

function closeMenu() {
  openId = null;
  const m = menu();
  if (m) { m.classList.remove("open"); m.inert = true; }
  for (const b of $("switcher").children) b.setAttribute("aria-expanded", "false");
}

function openMenu(g, btn) {
  const m = menu();
  m.textContent = "";
  for (const id of g.ids) {
    const s = SPECIES.find(x => x.id === id);
    if (!s) continue;
    const b = document.createElement("button");
    b.type = "button"; b.dataset.mode = id;
    b.setAttribute("aria-pressed", String(id === world.species));
    const dot = document.createElement("i"); dot.style.setProperty("--c", s.dot);
    b.append(dot, t("a." + id));
    b.addEventListener("click", () => { set("animal", id); closeMenu(); });
    m.append(b);
  }
  m.inert = false; m.classList.add("open");
  const r = btn.getBoundingClientRect(), w = m.offsetWidth;
  m.style.top = Math.round(r.bottom + 8) + "px";
  m.style.left = Math.round(Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8)) + "px";
  openId = g.id;
  for (const x of $("switcher").children) x.setAttribute("aria-expanded", String(x === btn));
}

function buildSwitcher() {
  const nav = $("switcher");
  nav.textContent = "";
  if (!menu()) {
    const m = document.createElement("nav");
    m.id = "groupmenu"; m.className = "menu"; m.inert = true;
    document.body.append(m);
    window.addEventListener("pointerdown", e => { if (openId && !e.target.closest("#switcher, #groupmenu")) closeMenu(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape" && openId) closeMenu(); });
    let lastW = window.innerWidth;                              // a taller or shorter window leaves the menu where it is
    window.addEventListener("resize", () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; closeMenu(); } });
  }
  closeMenu();
  nav.setAttribute("aria-label", t("ui.pick"));
  for (const g of GROUPS) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.group = g.id; b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false");
    const dot = document.createElement("i");
    const name = document.createElement("span"), count = document.createElement("small");
    count.textContent = g.ids.length;
    b.append(dot, name, count);
    b.addEventListener("click", () => { if (openId === g.id) closeMenu(); else openMenu(g, b); });
    nav.append(b);
  }
  markSwitcher();
}

/* the group that holds the current animal shows that animal; the others show their own name */
function markSwitcher() {
  const nav = $("switcher");
  nav.hidden = !cfg.switcher;
  if (nav.hidden) closeMenu();
  for (const b of nav.children) {
    const g = GROUPS.find(x => x.id === b.dataset.group), here = g.ids.includes(world.species);
    b.setAttribute("aria-pressed", String(here));
    b.firstChild.style.setProperty("--c", here ? dotOf(world.species) : "rgba(255,255,255,.35)");
    b.children[1].textContent = here ? t("a." + world.species) : t("g." + g.id);
    b.title = t("g." + g.id);
    b.lastChild.hidden = here;
  }
  const m = menu();
  if (m && openId) for (const b of m.children) b.setAttribute("aria-pressed", String(b.dataset.mode === world.species));
}

function style() {
  const T = cfg.title;
  root.lang = lang();
  root.style.setProperty("--title-scale", T.size);
  root.style.setProperty("--title-font", FONTS[T.font] || FONTS.sans);
  root.style.setProperty("--title-color", T.color);
  root.classList.toggle("no-glow", !T.glow);
}

export function refreshPage() { style(); renderTitle(); renderSearch(); buildSwitcher(); }
export { markSwitcher, renderTitle };

export function initPage() {
  $("search").addEventListener("submit", onSearch);
  refreshPage();
  setInterval(renderTitle, 1000);
}
