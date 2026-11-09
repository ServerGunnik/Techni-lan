import { sql, ready } from "../lib/db.js";
import { ownerHash, validNick, cleanText, codeOk, signupsOpen, fail, body } from "../lib/util.js";

const MAX_REGISTRATIONS = 400;

function validateTeam(raw, others, ownNick) {
  const name = cleanText(raw && raw.name);
  if (name.length < 2 || name.length > 24) return { error: "Nazwa drużyny ma mieć od 2 do 24 znaków." };
  const members = Array.isArray(raw && raw.members) ? raw.members.slice(0, 5).map(cleanText) : [];
  if (members.length !== 5 || members.some((n) => !validNick(n)))
    return { error: "Wpisz pięć poprawnych nicków (3 do 24 znaków) w składzie drużyny." };
  const reserve = cleanText(raw && raw.reserve);
  if (reserve && !validNick(reserve)) return { error: "Nick rezerwowego jest niepoprawny." };
  const all = members.concat(reserve ? [reserve] : []).map((n) => n.toLowerCase());
  if (all.some((n, i) => all.indexOf(n) !== i)) return { error: "Ten sam nick występuje w drużynie dwa razy." };
  if (!all.includes(ownNick.toLowerCase())) return { error: "Twój nick musi być w składzie drużyny." };
  for (const o of others) {
    if (o.team.name.toLowerCase() === name.toLowerCase()) return { error: "Drużyna o takiej nazwie już jest zgłoszona." };
    const theirs = o.team.members.concat(o.team.reserve ? [o.team.reserve] : []);
    const clash = theirs.find((n) => all.includes(n.toLowerCase()));
    if (clash) return { error: `Gracz ${clash} jest już w innej zgłoszonej drużynie.` };
  }
  const team = { name, members };
  if (reserve) team.reserve = reserve;
  return { team };
}

export default async function handler(req, res) {
  const owner = ownerHash(req);
  if (!owner) return fail(res, 400, "Brak identyfikatora przeglądarki. Odśwież stronę.");
  try {
    await ready();
    const db = sql();

    if (req.method === "DELETE") {
      await db`delete from registrations where owner = ${owner}`;
      return res.status(200).json({ ok: true });
    }
    if (req.method !== "POST") return fail(res, 405, "Nieobsługiwana metoda.");

    if (!signupsOpen()) return fail(res, 403, "Zapisy są zamknięte.");
    const b = body(req);
    if (!codeOk(b)) return fail(res, 403, "Zły kod turnieju. Kod poda organizator.");
    const nick = cleanText(b.nick);
    const mc = b.mc === true;
    const cs = b.cs === true;
    if (!validNick(nick))
      return fail(res, 400, "Nick ma mieć od 3 do 24 znaków: litery, cyfry, spacja, kropka, myślnik lub podkreślenie.");
    if (!mc && !cs) return fail(res, 400, "Zaznacz co najmniej jedną grę.");

    const taken = await db`select 1 from registrations where lower(nick) = lower(${nick}) and owner <> ${owner}`;
    if (taken.length) return fail(res, 409, "Taki nick jest już zapisany. Jeśli to Twój, dopisz coś, np. klasę.");

    let team = null;
    if (cs) {
      const others = (await db`select team from registrations where owner <> ${owner} and team is not null`).filter(
        (r) => r.team && r.team.name
      );
      const v = validateTeam(b.team, others, nick);
      if (v.error) return fail(res, 400, v.error);
      team = v.team;
    }

    const exists = await db`select 1 from registrations where owner = ${owner}`;
    if (!exists.length) {
      const [{ n }] = await db`select count(*)::int as n from registrations`;
      if (n >= MAX_REGISTRATIONS) return fail(res, 429, "Limit zapisów został osiągnięty. Napisz do organizatora.");
    }

    const teamJson = team ? JSON.stringify(team) : null;
    await db`
      insert into registrations (owner, nick, mc, cs, team)
      values (${owner}, ${nick}, ${mc}, ${cs}, ${teamJson}::jsonb)
      on conflict (owner) do update
      set nick = excluded.nick, mc = excluded.mc, cs = excluded.cs, team = excluded.team, example = false`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    if (e && e.code === "23505") return fail(res, 409, "Taki nick jest już zapisany.");
    console.error(e);
    return fail(res, 500, "Nie udało się zapisać. Spróbuj za chwilę.");
  }
}
