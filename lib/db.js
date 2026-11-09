import { neon } from "@neondatabase/serverless";

// Neon z Vercel Marketplace dodaje DATABASE_URL (a czasem POSTGRES_URL).
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let client;
export function sql() {
  if (!url) throw new Error("Brak zmiennej DATABASE_URL. Podłącz bazę Neon w panelu Vercel (Storage).");
  if (!client) client = neon(url);
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
