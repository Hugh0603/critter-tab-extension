/* Flowers that a click can plant: they open from the centre out, last a while, then wilt. */
import { world, rand, pick, cell, TAU, spark } from "../world.js";

const FLOWER = [];
[".PPP.", "PPpPP", "PpYpP", "PPpPP", ".PPP."].forEach((row, r) => {
  for (let c = 0; c < 5; c++) if (row[c] !== ".") FLOWER.push({ ox: c - 2, oy: r - 2, ch: row[c], d: Math.hypot(c - 2, r - 2) });
});
FLOWER.push({ ox: -3, oy: 1, ch: "L", d: 3 }, { ox: 3, oy: -1, ch: "L", d: 3 }, { ox: -3, oy: 2, ch: "L", d: 3.4 }, { ox: 3, oy: -2, ch: "L", d: 3.4 });

export const flowerCell = () => cell() * 0.62;

/* add a flower to the list; when there are more than max, the oldest wilts early */
export function plantFlower(flowers, x, y, life, max) {
  while (flowers.filter(f => !f.gone).length >= max) {
    const old = flowers.find(f => !f.gone);
    old.age = Math.max(old.age, old.life - 1.2); old.gone = true;
  }
  const hue = pick([330, 350, 280, 45, 20, 200, 0]);
  const f = { x, y, age: 0, life: life * rand(0.85, 1.15), hue, gone: false };
  flowers.push(f);
  for (let i = 0; i < 9; i++) {
    const a = rand(0, TAU), v = rand(40, 140);
    spark({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rand(0.4, 0.8), ch: pick(["*", ".", "+"]), c: `hsl(${hue},80%,75%)`, g: 160 });
  }
  return f;
}

export function ageFlowers(flowers, dt) {
  for (let i = flowers.length - 1; i >= 0; i--) {
    const f = flowers[i];
    f.age += dt;
    if (f.age >= f.life) { f.gone = true; flowers.splice(i, 1); }
  }
}

export function drawFlowers(flowers) {
  const ctx = world.ctx, s = flowerCell();
  for (const f of flowers) {
    const p = Math.min(1, f.age / 0.8), open = (1 - Math.pow(1 - p, 3)) * 3.6;
    const left = f.life - f.age, wilt = left < 2 ? left / 2 : 1, k = 0.75 + 0.25 * wilt;
    ctx.globalAlpha = wilt;
    for (const c of FLOWER) {
      if (c.d > open) continue;
      ctx.fillStyle = c.ch === "Y" ? "hsl(48,95%,60%)" : c.ch === "p" ? `hsl(${f.hue},85%,80%)` : c.ch === "L" ? "hsl(130,45%,36%)" : `hsl(${f.hue},75%,${62 + ((c.ox * 3 + c.oy * 5) & 3) * 2}%)`;
      ctx.fillRect(f.x + c.ox * s * k - s / 2, f.y + c.oy * s * k - s / 2, s - 1, s - 1);
    }
  }
  ctx.globalAlpha = 1;
}
