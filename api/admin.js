import { sql, ready } from "../lib/db.js";
import { adminOk, fail, body } from "../lib/util.js";
import { shuffle, seedOrder, computeRounds } from "../lib/bracket.js";

const DEMO_MC = ["KrzysCraft", "Creeper_Tomek", "Zuza_PvP", "Obsydian", "NetheriteNina", "Bartek_1v1"];
const DEMO_TEAMS = [
  { name: "Czwórka Mocy", members: ["Wojtas", "Kuba_AWP", "Maja.cs", "Szymon7", "Olek_Rush"], reserve: "Staszek_S" },
  { name: "Dymne Granaty", members: ["Ania_Smoke", "Filip_Flash", "Gosia9", "Dawid_Entry", "Leon_Lurk"] },
  { name: "Technicy", members: ["Mateusz_IGL", "Igor_Aim", "Pola_Anchor", "Hubert3", "Nikodem_Sup"], reserve: "Zosia_Back" },
  { name: "Piąta Runda", members: ["Patryk_Ace", "Julek_Eco", "Kasia_Pistol", "Adam_Hold", "Bruno_Peek"] },
];

async function saveBracket(db, game, data) {
  await db`
    insert into brackets (game, data) values (${game}, ${JSON.stringify(data)}::jsonb)
    on conflict (game) do update set data = excluded.data`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Nieobsługiwana metoda.");
  const auth = adminOk(req);
  if (auth === "missing") return fail(res, 503, "Ustaw zmienną ADMIN_PASSWORD w panelu Vercel i wdróż stronę ponownie.");
  if (auth !== "ok") return fail(res, 401, "Złe hasło organizatora.");
  try {
    await ready();
    const db = sql();
    const b = body(req);
    const game = b.game === "mc" || b.game === "cs" ? b.game : null;

    switch (b.action) {
      case "check":
        return res.status(200).json({ ok: true });

      case "draw-mc": {
        const rows = await db`select nick from registrations where mc order by id`;
        if (rows.length < 2) return fail(res, 400, "Do losowania w Minecraft potrzeba co najmniej 2 osób.");
        const order = seedOrder(shuffle(rows.map((r) => r.nick)));
        await saveBracket(db, "mc", { order, winners: {}, drawnAt: Date.now(), players: rows.length });
        return res.status(200).json({ ok: true, message: `Wylosowano Minecraft: ${rows.length} graczy.` });
      }

      case "draw-cs": {
        const rows = await db`select team from registrations where cs and team is not null order by id`;
        const teams = rows.map((r) => r.team).filter((t) => t && t.name);
        if (teams.length < 2) return fail(res, 400, "Do losowania w CS potrzeba co najmniej 2 zgłoszonych drużyn.");
        const order = seedOrder(shuffle(teams.map((t) => t.name)));
        await saveBracket(db, "cs", { teams, order, winners: {}, drawnAt: Date.now() });
        return res.status(200).json({ ok: true, message: `Wylosowano drabinkę CS: ${teams.length} drużyn.` });
      }

      case "clear": {
        if (!game) return fail(res, 400, "Nieznana gra.");
        await db`delete from brackets where game = ${game}`;
        return res.status(200).json({ ok: true, message: "Wyczyszczono drabinkę." });
      }

      case "winner": {
        if (!game) return fail(res, 400, "Nieznana gra.");
        const [row] = await db`select data from brackets where game = ${game}`;
        if (!row) return fail(res, 404, "Ta drabinka jeszcze nie została wylosowana.");
        const data = row.data;
        const match = computeRounds(data.order, data.winners)
          .flat()
          .find((m) => m.key === b.key);
        if (!match || !match.a || !match.b || (b.name !== match.a && b.name !== match.b))
          return fail(res, 400, "Nie można zaznaczyć tego zwycięzcy.");
        data.winners = { ...(data.winners || {}), [b.key]: b.name };
        await saveBracket(db, game, data);
        return res.status(200).json({ ok: true });
      }

      case "delete-reg": {
        const id = Number(b.id);
        if (!Number.isInteger(id)) return fail(res, 400, "Zły identyfikator.");
        await db`delete from registrations where id = ${id}`;
        return res.status(200).json({ ok: true, message: "Usunięto zgłoszenie." });
      }

      case "seed-demo": {
        await db`delete from registrations where example`;
        let i = 0;
        for (const nick of DEMO_MC) {
          await db`insert into registrations (owner, nick, mc, cs, example) values (${"demo-mc-" + i++}, ${nick}, true, false, true)
                   on conflict do nothing`;
        }
        for (const t of DEMO_TEAMS) {
          await db`insert into registrations (owner, nick, mc, cs, team, example)
                   values (${"demo-cs-" + i++}, ${t.members[0]}, false, true, ${JSON.stringify(t)}::jsonb, true)
                   on conflict do nothing`;
        }
        return res.status(200).json({ ok: true, message: "Dodano przykładowe zapisy." });
      }

      case "clear-demo":
        await db`delete from registrations where example`;
        return res.status(200).json({ ok: true, message: "Usunięto przykładowe zapisy." });

      default:
        return fail(res, 400, "Nieznana akcja.");
    }
  } catch (e) {
    console.error(e);
    return fail(res, 500, "Operacja się nie udała. Sprawdź logi w panelu Vercel.");
  }
}
