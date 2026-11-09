import { createHash, timingSafeEqual } from "node:crypto";

export function sha(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

// Każda przeglądarka ma losowy sekret zapisany lokalnie. W bazie trzymamy tylko jego skrót.
export function ownerHash(req) {
  const t = req.headers["x-owner"];
  if (typeof t !== "string" || t.length < 20 || t.length > 200) return null;
  return sha(t);
}

export function validNick(n) {
  return (
    typeof n === "string" &&
    n.length >= 3 &&
    n.length <= 24 &&
    /^[A-Za-z0-9_.\-ĄąĆćĘęŁłŃńÓóŚśŹźŻż ]+$/.test(n)
  );
}

export function cleanText(v) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

// Jeśli ustawiono JOIN_CODE, zapis i ankieta wymagają kodu podanego przez organizatora.
export function codeRequired() {
  return Boolean(process.env.JOIN_CODE);
}
export function codeOk(body) {
  const need = process.env.JOIN_CODE;
  if (!need) return true;
  const got = cleanText(body && body.code);
  const a = Buffer.from(sha(got));
  const b = Buffer.from(sha(need));
  return timingSafeEqual(a, b);
}

// Koniec zapisów ustawiasz zmienną SIGNUP_DEADLINE, np. 2026-11-13T23:59:59+01:00 (czas polski).
// Bez tej zmiennej zapisy są otwarte bez końca.
export function deadlineMs() {
  const d = Date.parse(process.env.SIGNUP_DEADLINE || "");
  return Number.isFinite(d) ? d : 0;
}
export function signupsOpen() {
  const d = deadlineMs();
  return !d || Date.now() <= d;
}

export function adminOk(req) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return "missing";
  const h = req.headers.authorization || "";
  const got = h.startsWith("Bearer ") ? h.slice(7) : "";
  const a = Buffer.from(sha(got));
  const b = Buffer.from(sha(pw));
  return timingSafeEqual(a, b) ? "ok" : "bad";
}

export function fail(res, status, error) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ error });
}

export function body(req) {
  const b = req.body;
  if (b && typeof b === "object") return b;
  try {
    return JSON.parse(b || "{}");
  } catch {
    return {};
  }
}
