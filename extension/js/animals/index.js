/*
 * Every animal is one file exporting a "species":
 *   id, dot (colour of its switcher dot), theme and particles it suits,
 *   density (animals per px² at count 1), margin, glyphScale,
 *   init(animals), make(x, y),
 *   optional update(dt, t), under(t), over(t)   – extra layers below / above the animals
 *   optional poke(x, y)                          – its own click; return true if handled
 * and each animal it makes has update(dt, t), draw(t), hit(angle, distance, strength),
 * and optionally shadow(). To add an animal: write the file and list it here.
 */
import penguin from "./penguin.js";
import frog from "./frog.js";
import fish from "./fish.js";
import cat from "./cat.js";
import butterfly from "./butterfly.js";
import jelly from "./jelly.js";
import hedgehog from "./hedgehog.js";
import octopus from "./octopus.js";
import ghost from "./ghost.js";
import crab from "./crab.js";
import slime from "./slime.js";
import dino from "./dino.js";
import squid from "./squid.js";
import mouse from "./mouse.js";
import bee from "./bee.js";
import spider from "./spider.js";
import chameleon from "./chameleon.js";
import dog from "./dog.js";
import bat from "./bat.js";
import snail from "./snail.js";
import owl from "./owl.js";
import duck from "./duck.js";
import snake from "./snake.js";
import ufo from "./ufo.js";

export const SPECIES = [penguin, frog, fish, cat, butterfly, jelly, hedgehog, octopus, ghost, crab, slime, dino, squid, mouse, bee, spider, chameleon, dog, bat, snail, owl, duck, snake, ufo];
export const byId = id => SPECIES.find(s => s.id === id);

/* how the animals are sorted in the switcher and in the settings; every species belongs to exactly one group */
export const GROUPS = [
  { id: "water", ids: ["frog", "duck", "fish", "crab", "jelly", "octopus", "squid"] },
  { id: "land", ids: ["cat", "dog", "mouse", "hedgehog", "penguin", "dino"] },
  { id: "garden", ids: ["butterfly", "bee", "snail", "chameleon"] },
  { id: "night", ids: ["owl", "bat", "spider", "ghost"] },
  { id: "fun", ids: ["ufo", "slime", "snake"] }
];
export const groupOf = id => GROUPS.find(g => g.ids.includes(id));
