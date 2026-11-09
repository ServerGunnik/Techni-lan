import { neon } from "@neondatabase/serverless";

// Neon z Vercel Marketplace dodaje DATABASE_URL i POSTGRES_URL, ale przy własnym prefiksie
// (domyślnie bywa STORAGE) nazwy wyglądają np. STORAGE_DATABASE_URL. Szukamy każdej z nich.
function findUrl() {
  const e = process.env;
  if (e.DATABASE_URL) return e.DATABASE_URL;
  if (e.POSTGRES_URL) return e.POSTGRES_URL;
  const isPg = (k) => /^postgres(ql)?:\/\//.test(e[k] || "");
  const names = Object.keys(e).filter((k) => /(DATABASE_URL|POSTGRES_URL|_URL)$/.test(k) && isPg(k));
  const pooled = names.find((k) => /(DATABASE_URL|POSTGRES_URL)$/.test(k) && !/UNPOOLED|NON_POOLING/.test(k));
  const pick = pooled || names[0];
  return pick ? e[pick] : "";
}

let client;
export function sql() {
  if (!client) {
    const url = findUrl();
    if (!url) {
      const seen = Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|NEON|STORAGE/i.test(k));
      throw new Error(
        "Brak adresu bazy. Podłącz Neon w panelu Vercel (Storage) i zrób Redeploy. Widoczne zmienne (tylko nazwy): " +
          (seen.join(", ") || "brak")
      );
    }
    client = neon(url);
  }
  return client;
}

let schema;
// Tworzy tabele przy pierwszym uruchomieniu funkcji. Bezpieczne do wielokrotnego wywołania.
export function ready() {
  if (!schema) {
    const db = sql();
    schema = (async () => {
      await db`create table if not exists registrations (
        id bigserial primary key,
        owner text not null unique,
        nick text not null,
        mc boolean not null default false,
        cs boolean not null default false,
        team jsonb,
        example boolean not null default false,
        created_at timestamptz not null default now()
      )`;
      await db`create unique index if not exists registrations_nick_uq on registrations (lower(nick))`;
      await db`create table if not exists availability (
        owner text primary key,
        nick text not null,
        d20 text not null,
        d27 text not null,
        updated_at timestamptz not null default now()
      )`;
      await db`create table if not exists brackets (
        game text primary key,
        data jsonb not null
      )`;
    })().catch((e) => {
      schema = undefined;
      throw e;
    });
  }
  return schema;
}
