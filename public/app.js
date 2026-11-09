(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DATES = [
    { k: "d20", label: "Piątek 20 listopada" },
    { k: "d27", label: "Piątek 27 listopada" },
  ];
  const OPTS = [
    ["yes", "Mogę"],
    ["maybe", "Może"],
    ["no", "Nie mogę"],
  ];

  const S = {
    regs: [], poll: [], mc: null, cs: null,
    requiresCode: false, ready: false,
    formTouched: false, pollTouched: false,
    admin: false, pw: "", open: true, deadline: 0,
  };

  /* ---------- identyfikator przeglądarki ---------- */
  const token = (() => {
    try {
      let t = localStorage.getItem("tt-token");
      if (!t) {
        t = crypto.randomUUID() + crypto.randomUUID();
        localStorage.setItem("tt-token", t);
      }
      return t;
    } catch {
      return crypto.randomUUID() + crypto.randomUUID();
    }
  })();

  async function api(path, { method = "GET", body, admin = false } = {}) {
    const headers = { "x-owner": token };
    if (body) headers["content-type"] = "application/json";
    if (admin) headers.authorization = "Bearer " + S.pw;
    const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let j = {};
    try { j = await r.json(); } catch { /* pusta odpowiedź */ }
    if (!r.ok) throw Object.assign(new Error(j.error || "Coś poszło nie tak."), { status: r.status });
    return j;
  }

  /* ---------- pomocnicze ---------- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function say(node, text, kind) {
    node.textContent = text || "";
    node.className = "msg" + (kind ? " " + kind : "");
  }
  const myReg = () => S.regs.find((r) => r.mine) || null;
  const myNick = () => (myReg() ? myReg().nick : null);

  /* ---------- logika drabinki (taka sama jak na serwerze) ---------- */
  function computeRounds(order, winners) {
    winners = winners || {};
    const rounds = [];
    let cur = [];
    for (let i = 0; i < order.length; i += 2) cur.push([order[i], order[i + 1]]);
    let r = 0;
    for (;;) {
      const ms = cur.map(([a, b], idx) => {
        const key = r + "-" + idx;
        let w = "";
        if (a && !b) w = a;
        else if (b && !a) w = b;
        else if (a && b && (winners[key] === a || winners[key] === b)) w = winners[key];
        return { a, b, w, key, bye: !(a && b) && !!(a || b) };
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
  function roundName(idx, total) {
    const left = total - idx;
    if (left === 1) return "Finał";
    if (left === 2) return "Półfinał";
    if (left === 3) return "Ćwierćfinał";
    return "Runda " + (idx + 1);
  }

  /* ---------- rysowanie ---------- */
  function chip(text, reg) {
    const li = el("li", reg.mine ? "me" : "", text);
    if (S.admin) {
      const b = el("button", "x", "×");
      b.type = "button";
      b.title = "Usuń zgłoszenie";
      b.addEventListener("click", () => adminAct({ action: "delete-reg", id: reg.id }));
      li.appendChild(b);
    }
    return li;
  }
  function renderLists() {
    for (const game of ["mc", "cs"]) {
      const isCs = game === "cs";
      const key = (r) => (isCs ? r.team.name : r.nick).toLowerCase();
      const list = S.regs
        .filter((r) => (isCs ? r.cs && r.team : r.mc))
        .sort((a, b) => (key(a) < key(b) ? -1 : 1));
      const ul = $("list-" + game);
      ul.textContent = "";
      for (const r of list) ul.appendChild(chip(isCs ? r.team.name + ": " + r.team.members.join(", ") : r.nick, r));
      const c = $("count-" + game);
      if (!S.ready) c.textContent = "Wczytuję zapisy…";
      else if (!list.length) c.textContent = isCs ? "Żadna drużyna się jeszcze nie zgłosiła." : "Nikt się jeszcze nie zapisał. Możesz być pierwszy.";
      else c.textContent = (isCs ? "Zgłoszonych drużyn: " : "Zapisanych: ") + list.length;
    }
  }
  function teamHasMe(doc, teamName, me) {
    if (!me || !doc.teams) return false;
    return doc.teams.some((t) => t.name === teamName && t.members.includes(me));
  }
  function renderBracket(host, doc, game) {
    host.textContent = "";
    if (!doc || !doc.order || !doc.order.length) {
      host.appendChild(el("p", "empty", "Losowanie jeszcze się nie odbyło. " + (game === "cs" ? "Drużyny" : "Pary") + " pojawią się tutaj po zamknięciu zapisów."));
      return;
    }
    const rounds = computeRounds(doc.order, doc.winners);
    const me = myNick();
    const grid = el("div", "bracket-grid");
    rounds.forEach((ms, ri) => {
      const col = el("div", "round");
      col.appendChild(el("span", "round-title", roundName(ri, rounds.length)));
      for (const m of ms) {
        const box = el("div", "match");
        [m.a, m.b].forEach((name) => {
          const clickable = S.admin && m.a && m.b && !m.bye;
          const s = el(clickable ? "button" : "div", "slot");
          if (clickable) { s.type = "button"; s.title = "Zaznacz zwycięzcę"; }
          if (!name) {
            s.textContent = m.bye ? "wolny los" : "czeka na wynik";
            s.className += m.bye ? " bye" : " wait";
          } else {
            s.textContent = name;
            if (m.w) s.className += m.w === name ? " win" : " lose";
            if (game === "mc" && name === me) s.className += " me";
            if (game === "cs" && teamHasMe(doc, name, me)) s.className += " me";
            if (clickable) s.addEventListener("click", () => adminAct({ action: "winner", game, key: m.key, name }));
          }
          box.appendChild(s);
        });
        col.appendChild(box);
      }
      grid.appendChild(col);
    });
    host.appendChild(grid);
    const last = rounds[rounds.length - 1][0];
    if (last.w) host.appendChild(el("p", "champ", "Zwycięzca turnieju: " + last.w));
    else if (S.admin) host.appendChild(el("p", "sub", "Kliknij nick w meczu, żeby zaznaczyć zwycięzcę."));
  }
  function renderTeams() {
    const host = $("teams-cs");
    host.textContent = "";
    const d = S.cs;
    if (!d || !d.teams) return;
    const wrap = el("div", "teams");
    for (const t of d.teams) {
      const box = el("div", "team");
      box.appendChild(el("h3", "", t.name));
      const ul = el("ul");
      for (const n of t.members) ul.appendChild(el("li", "", n));
      if (t.reserve) ul.appendChild(el("li", "", t.reserve + " (rezerwa)"));
      box.appendChild(ul);
      wrap.appendChild(box);
    }
    host.appendChild(wrap);
    host.style.marginBottom = "4px";
  }
  function buildPoll() {
    const host = $("poll-choices");
    for (const d of DATES) {
      const fs = el("fieldset");
      fs.appendChild(el("legend", "", d.label));
      const row = el("div", "poll-opts");
      for (const o of OPTS) {
        const lab = el("label", "pill-opt");
        const inp = document.createElement("input");
        inp.type = "radio"; inp.name = "poll-" + d.k; inp.value = o[0]; inp.id = "poll-" + d.k + "-" + o[0];
        lab.appendChild(inp);
        lab.appendChild(el("span", "", o[1]));
        row.appendChild(lab);
      }
      fs.appendChild(row);
      host.appendChild(fs);
    }
  }
  function renderPoll() {
    const host = $("poll-results");
    host.textContent = "";
    if (!S.poll.length) {
      host.appendChild(el("p", "empty", S.loadFailed ? "Nie udało się wczytać odpowiedzi. Odśwież stronę za chwilę." : S.ready ? "Nikt jeszcze nie odpowiedział. Możesz być pierwszy." : "Wczytuję odpowiedzi…"));
      return;
    }
    const yesCounts = [];
    for (const d of DATES) {
      const by = { yes: [], maybe: [], no: [] };
      for (const p of S.poll) if (by[p[d.k]]) by[p[d.k]].push(p.nick);
      yesCounts.push(by.yes.length);
      const card = el("div", "card poll-card");
      card.appendChild(el("h3", "", d.label));
      const bar = el("div", "bar");
      for (const o of OPTS) {
        const n = by[o[0]].length;
        if (!n) continue;
        const seg = el("span", "seg " + o[0], String(n));
        seg.style.flexGrow = n;
        seg.title = o[1] + ": " + n;
        bar.appendChild(seg);
      }
      card.appendChild(bar);
      for (const [label, names] of [["Mogą", by.yes], ["Może", by.maybe]]) {
        if (!names.length) continue;
        const p = el("p", "poll-line");
        p.appendChild(el("b", "", label + " (" + names.length + "): "));
        p.appendChild(document.createTextNode(names.join(", ")));
        card.appendChild(p);
      }
      if (by.no.length) card.appendChild(el("p", "poll-line", "Nie mogą: " + by.no.length));
      host.appendChild(card);
    }
    const lead = el("p", "lead");
    lead.textContent = yesCounts[0] === yesCounts[1]
      ? "Na razie remis: oba terminy mają tyle samo odpowiedzi „Mogę”."
      : "Na razie prowadzi: " + DATES[yesCounts[0] > yesCounts[1] ? 0 : 1].label + ".";
    lead.style.gridColumn = "1 / -1";
    host.appendChild(lead);
  }
  function applyDeadline() {
    const open = S.open !== false;
    let when = "";
    if (S.deadline) when = new Date(S.deadline).toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
    $("deadline").textContent = open ? (when ? "Zapisy otwarte. Zamykamy: " + when + "." : "Zapisy otwarte.") : "Zapisy są zamknięte. Dziękujemy za zgłoszenia.";
    $("eyebrow").textContent = open ? "Zapisy otwarte" : "Zapisy zamknięte";
    document.querySelectorAll("#form input, #poll-form input, #save, #poll-save").forEach((i) => { i.disabled = !open; });
  }
  function renderAll() {
    renderLists();
    renderBracket($("br-mc"), S.mc, "mc");
    renderBracket($("br-cs"), S.cs, "cs");
    renderTeams();
    renderPoll();
    $("admin-box").hidden = !S.admin;
    $("demo-note").hidden = !S.regs.some((r) => r.example);
    $("clear-demo").hidden = !S.admin;
    $("code-field").hidden = !S.requiresCode;
    applyDeadline();
  }

  /* ---------- formularze ---------- */
  function toggleTeam() { $("team-box").hidden = !$("g-cs").checked; }
  function fillForm() {
    const me = myReg();
    if (me && document.activeElement !== $("nick") && !S.formTouched) {
      $("nick").value = me.nick;
      $("g-mc").checked = !!me.mc;
      $("g-cs").checked = !!me.cs;
      if (me.team) {
        $("team-name").value = me.team.name;
        for (let i = 0; i < 5; i++) $("m" + (i + 1)).value = me.team.members[i] || "";
        $("m6").value = me.team.reserve || "";
      }
      toggleTeam();
    }
    $("save").textContent = me ? "Zapisz zmiany" : "Zapisz mnie";
    $("leave").hidden = !me;
  }
  function fillPoll() {
    if (S.pollTouched) return;
    const mine = S.poll.find((p) => p.mine);
    const n = $("poll-nick");
    if (mine) {
      n.value = mine.nick;
      for (const d of DATES) {
        const r = $("poll-" + d.k + "-" + mine[d.k]);
        if (r) r.checked = true;
      }
    } else if (!n.value && myNick()) n.value = myNick();
  }

  async function submit(ev) {
    ev.preventDefault();
    const msg = $("msg");
    const cs = $("g-cs").checked;
    const body = {
      nick: $("nick").value,
      mc: $("g-mc").checked,
      cs,
      code: $("code").value,
    };
    if (cs) {
      body.team = {
        name: $("team-name").value,
        members: [1, 2, 3, 4, 5].map((i) => $("m" + i).value),
        reserve: $("m6").value,
      };
    }
    $("save").disabled = true;
    try {
      await api("/api/register", { method: "POST", body });
      S.formTouched = false;
      say(msg, "Zapisano. Do zobaczenia na turnieju, " + body.nick.trim() + "!", "ok");
      await load();
    } catch (e) {
      say(msg, e.message, "err");
    }
    $("save").disabled = false;
  }
  async function leave() {
    try {
      await api("/api/register", { method: "DELETE" });
      S.formTouched = false;
      $("nick").value = ""; $("g-mc").checked = false; $("g-cs").checked = false;
      toggleTeam();
      say($("msg"), "Wypisano z turnieju.", "ok");
      await load();
    } catch (e) {
      say($("msg"), e.message, "err");
    }
  }
  async function submitPoll(ev) {
    ev.preventDefault();
    const msg = $("poll-msg");
    const body = { nick: $("poll-nick").value, code: $("code").value };
    for (const d of DATES) {
      const c = document.querySelector('input[name="poll-' + d.k + '"]:checked');
      body[d.k] = c ? c.value : "";
    }
    $("poll-save").disabled = true;
    try {
      await api("/api/poll", { method: "POST", body });
      S.pollTouched = false;
      say(msg, "Zapisano odpowiedź. Możesz ją zmienić w każdej chwili.", "ok");
      await load();
    } catch (e) {
      say(msg, e.message, "err");
    }
    $("poll-save").disabled = false;
  }

  /* ---------- organizator ---------- */
  async function adminAct(body) {
    try {
      const r = await api("/api/admin", { method: "POST", body, admin: true });
      say($("admin-msg"), r.message || "", "ok");
      await load();
    } catch (e) {
      say($("admin-msg"), e.message, "err");
      if (e.status === 401) { S.admin = false; renderAll(); }
    }
  }
  async function login(ev) {
    if (ev) ev.preventDefault();
    const pw = $("pw").value;
    if (!pw) return;
    S.pw = pw;
    try {
      await api("/api/admin", { method: "POST", body: { action: "check" }, admin: true });
      S.admin = true;
      try { sessionStorage.setItem("tt-pw", pw); } catch { /* bez zapamiętania */ }
      say($("login-msg"), "Zalogowano.", "ok");
      renderAll();
    } catch (e) {
      S.admin = false;
      say($("login-msg"), e.message, "err");
    }
  }

  /* ---------- dane ---------- */
  async function load() {
    try {
      const d = await api("/api/state");
      S.regs = d.regs; S.poll = d.poll; S.mc = d.brackets.mc; S.cs = d.brackets.cs;
      S.requiresCode = !!d.requiresCode;
      S.open = d.open !== false;
      S.deadline = d.deadline || 0;
      S.ready = true;
      S.loadFailed = false;
      fillForm(); fillPoll(); renderAll();
    } catch (e) {
      S.ready = true;
      S.loadFailed = true;
      renderPoll();
      $("count-mc").textContent = "Nie udało się wczytać zapisów. Odśwież stronę.";
      $("count-cs").textContent = "Nie udało się wczytać zapisów. Odśwież stronę.";
    }
  }

  /* ---------- start ---------- */
  buildPoll();
  $("g-cs").addEventListener("change", toggleTeam);
  $("form").addEventListener("submit", submit);
  $("form").addEventListener("input", () => { S.formTouched = true; });
  $("leave").addEventListener("click", leave);
  $("poll-form").addEventListener("submit", submitPoll);
  $("poll-form").addEventListener("input", () => { S.pollTouched = true; });
  $("login-form").addEventListener("submit", login);
  $("draw-mc").addEventListener("click", () => adminAct({ action: "draw-mc" }));
  $("draw-cs").addEventListener("click", () => adminAct({ action: "draw-cs" }));
  $("clear-mc").addEventListener("click", () => adminAct({ action: "clear", game: "mc" }));
  $("clear-cs").addEventListener("click", () => adminAct({ action: "clear", game: "cs" }));
  $("seed-demo").addEventListener("click", () => adminAct({ action: "seed-demo" }));
  $("clear-demo").addEventListener("click", () => adminAct({ action: "clear-demo" }));

  renderAll();
  load();
  setInterval(() => { if (!document.hidden) load(); }, 20000);
  try {
    const saved = sessionStorage.getItem("tt-pw");
    if (saved) { $("pw").value = saved; login(); }
  } catch { /* brak zapisanego hasła */ }
})();
