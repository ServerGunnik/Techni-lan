import { sql, ready } from "../lib/db.js";
import { ownerHash, validNick, cleanText, codeOk, signupsOpen, fail, body } from "../lib/util.js";

const ANSWERS = ["yes", "maybe", "no"];

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Nieobsługiwana metoda.");
  const owner = ownerHash(req);
  if (!owner) return fail(res, 400, "Brak identyfikatora przeglądarki. Odśwież stronę.");
  try {
    await ready();
    if (!signupsOpen()) return fail(res, 403, "Zapisy są zamknięte.");
    const b = body(req);
    if (!codeOk(b)) return fail(res, 403, "Zły kod turnieju. Kod poda organizator.");
    const nick = cleanText(b.nick);
    if (!validNick(nick)) return fail(res, 400, "Wpisz swój nick: od 3 do 24 znaków.");
    if (!ANSWERS.includes(b.d20) || !ANSWERS.includes(b.d27))
      return fail(res, 400, "Zaznacz odpowiedź dla każdego terminu.");
    const db = sql();
    await db`
      insert into availability (owner, nick, d20, d27)
      values (${owner}, ${nick}, ${b.d20}, ${b.d27})
      on conflict (owner) do update
      set nick = excluded.nick, d20 = excluded.d20, d27 = excluded.d27, updated_at = now()`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return fail(res, 500, "Nie udało się zapisać odpowiedzi. Spróbuj za chwilę.");
  }
}
