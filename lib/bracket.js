import { randomInt } from "node:crypto";

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Układa uczestników w liście o długości potęgi dwójki. "" oznacza wolny los.
// Każdy mecz ma co najmniej jednego prawdziwego uczestnika.
export function seedOrder(entries) {
  const n = entries.length;
  let size = 2;
  while (size < n) size *= 2;
  const matches = size / 2;
  const out = [];
  for (let i = 0; i < matches; i++) out.push(entries[i] || "", entries[matches + i] || "");
  return out;
}

export function computeRounds(order, winners = {}) {
  const rounds = [];
  let cur = [];
  for (let i = 0; i < order.length; i += 2) cur.push([order[i], order[i + 1]]);
  let r = 0;
  for (;;) {
    const ms = cur.map(([a, b], idx) => {
      const key = `${r}-${idx}`;
      let w = "";
      if (a && !b) w = a;
      else if (b && !a) w = b;
      else if (a && b && (winners[key] === a || winners[key] === b)) w = winners[key];
      return { a, b, w, key, bye: !(a && b) && Boolean(a || b) };
    });
    rounds.push(ms);
    if (ms.length === 1) break;
    const next = [];
    for (let m = 0; m < ms.length; m += 2) next.push([ms[m].w, ms[m + 1].w]);
    cur = next;
    r++;
  }
  return rounds;
}
