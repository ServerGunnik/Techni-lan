# Techni-lan: turniej szkolny Minecraft i CS

Strona zapisów: nick gracza, zgłaszanie drużyn CS, ankieta terminów (20 i 27 listopada),
losowanie drabinek i wyniki. Statyczna strona + funkcje Vercel + baza Postgres (Neon).

## Wdrożenie na Vercel

1. Wrzuć ten folder do repozytorium na GitHubie i zaimportuj je w Vercel (**Add New → Project**).
   Framework zostaw na **Other**, nic nie zmieniaj w ustawieniach budowania.
   (Możesz też użyć `vercel` w terminalu z tego folderu.)
2. W projekcie wejdź w **Storage**, wybierz **Neon** (Postgres) z Marketplace i podłącz do projektu.
   Vercel doda zmienną z adresem bazy (`DATABASE_URL` albo z prefiksem, np. `STORAGE_DATABASE_URL`; strona rozpoznaje obie).
   Tabele tworzą się same przy pierwszym wejściu na stronę. Po podłączeniu bazy zrób Redeploy.
3. W **Settings → Environment Variables** dodaj:
   - `ADMIN_PASSWORD` – hasło organizatora (obowiązkowe).
   - `JOIN_CODE` – kod turnieju dla uczniów (opcjonalnie, chroni przed spamem; ustaw, jeśli link trafi poza szkołę).
   - `SIGNUP_DEADLINE` – koniec zapisów (opcjonalnie), np. `2026-11-13T23:59:59+01:00` (czas polski).
     Po tym czasie serwer odrzuca zapisy i ankietę (wypisać się nadal można). Bez tej zmiennej zapisy są otwarte bez końca.
4. Wdróż ponownie (**Deployments → Redeploy**), żeby zmienne zadziałały.

## Wersja pod zapisy

Ta wersja zbiera tylko zapisy, zgłoszenia drużyn CS i odpowiedzi w ankiecie terminów. Harmonogram, losowanie i drabinki
są wyłączone (ukryte w `public/index.html` w bloku `<div hidden>` nad stopką). Backend losowania w `api/admin.js` jest gotowy,
więc po ustaleniu formatu wystarczy usunąć atrybut `hidden` z tego bloku.

## Panel organizatora

Na dole strony rozwiń **Panel organizatora** i wpisz `ADMIN_PASSWORD`. W wersji pod zapisy możesz usuwać zgłoszenia
(przycisk × przy nicku). Losowanie i wyniki meczów pojawią się po odkryciu bloku opisanego wyżej.

## Logo szkoły

Wrzuć plik `public/logo.png` (najlepiej PNG z przezroczystym tłem). Pojawi się jako delikatne tło nagłówka.
Siłę przezroczystości zmienisz w `public/index.html` (`header::before`, `opacity`).

## Jak to działa

- Uczeń nie loguje się. Przeglądarka dostaje losowy sekret zapisany lokalnie, a w bazie jest tylko jego skrót.
  Dzięki temu może później zmienić lub usunąć swój zapis (tylko z tej samej przeglądarki).
- Nick musi być unikalny (bez rozróżniania wielkości liter). Drużyna: 5 osób + opcjonalnie rezerwowy,
  nick kapitana musi być w składzie, gracz nie może być w dwóch drużynach.
- Strona odświeża dane co 20 sekund.

## Pliki

- `public/index.html`, `public/app.js` – strona
- `api/state.js` – odczyt danych
- `api/register.js` – zapis i wypisanie z turnieju
- `api/poll.js` – ankieta terminów
- `api/admin.js` – losowanie, wyniki, moderacja
- `lib/` – baza danych, walidacja, logika drabinki
