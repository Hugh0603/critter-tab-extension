/*
 * The toolbar popup: two switches for the two bits of chrome on the new tab page.
 * It shares localStorage with the page, so a flip shows up in open tabs at once.
 * With both switched off the page is just the pond.
 */
import { cfg, load, set, flush } from "./settings.js";
import { t, lang } from "./i18n.js";

load();
document.documentElement.lang = lang();
document.getElementById("hint").textContent = t("pop.hint");

const ITEMS = [["switcher", "pop.switcher"], ["gear", "pop.gear"]];
const empty = document.getElementById("empty");
const paintEmpty = () => { empty.hidden = cfg.switcher || cfg.gear; empty.textContent = t("pop.empty"); };

for (const [key, text] of ITEMS) {
  const row = document.createElement("label"), box = document.createElement("div"), main = document.createElement("span");
  const sw = document.createElement("input"), hint = document.createElement("small");
  row.className = "row"; sw.className = "switch"; sw.type = "checkbox"; sw.checked = cfg[key];
  main.textContent = t(text); hint.textContent = t(text + ".hint"); main.append(hint);
  sw.addEventListener("change", () => { set(key, sw.checked); flush(); paintEmpty(); });
  row.append(main, sw);
  document.getElementById("list").append(row);
}
paintEmpty();
