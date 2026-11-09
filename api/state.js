import { sql, ready } from "../lib/db.js";
import { ownerHash, codeRequired, signupsOpen, deadlineMs, fail } from "../lib/util.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Nieobsługiwana metoda.");
  try {
    await ready();
    const db = sql();
    const owner = ownerHash(req) || "";
    const regs = await db`
      select id, nick, mc, cs, team, example, (owner = ${owner}) as mine
      from registrations order by id`;
    const poll = await db`
      select nick, d20, d27, (owner = ${owner}) as mine
      from availability order by updated_at`;
    const rows = await db`select game, data from brackets`;
    const brackets = { mc: null, cs: null };
    for (const r of rows) brackets[r.game] = r.data;
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({
      regs: regs.map((r) => ({ ...r, id: Number(r.id) })),
      poll,
      brackets,
      requiresCode: codeRequired(),
      open: signupsOpen(),
      deadline: deadlineMs(),
    });
  } catch (e) {
    console.error(e);
    return fail(res, 500, "Nie udało się wczytać danych. Spróbuj odświeżyć stronę.");
  }
}
