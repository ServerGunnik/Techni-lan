import { sql, ready } from "../lib/db.js";

// Tymczasowa diagnostyka: pokazuje, czy strona widzi bazę. Nie zwraca haseł ani adresu bazy.
// Po uruchomieniu zapisów możesz usunąć ten plik.
const clean = (m) => String(m || "").replace(/postgres(ql)?:\/\/\S+/gi, "[adres bazy]").slice(0, 300);

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  const out = {
    node: process.version,
    envNames: Object.keys(process.env)
      .filter((k) => /DATABASE|POSTGRES|NEON|STORAGE/i.test(k))
      .sort(),
    steps: {},
  };
  try {
    const db = sql();
    out.steps.adresBazy = "znaleziony";
    await db`select 1 as ok`;
    out.steps.polaczenie = "ok";
    await ready();
    out.steps.tabele = "ok";
    const [{ n }] = await db`select count(*)::int as n from registrations`;
    out.steps.zapisow = n;
    out.ok = true;
  } catch (e) {
    out.ok = false;
    out.error = clean(e && e.message);
    out.errorName = e && e.name;
    out.code = e && e.code;
  }
  return res.status(out.ok ? 200 : 500).json(out);
}
