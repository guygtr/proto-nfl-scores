// Pointage NFL en direct — prototype. Aucune clé requise.
// 1) proxy local (server.py) ; 2) ESPN direct en secours (CORS pas toujours présent chez ESPN)
const SOURCES = ["/api/scoreboard", "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"];
const FAVORIS = ["NE", "BUF"]; // Patriots et Bills
const REFRESH_MS = 30000;
const TZ = "America/Toronto";

const $ = (id) => document.getElementById(id);
const _fmtH = new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtHeure = { format: (d) => { const p = Object.fromEntries(_fmtH.formatToParts(d).map((x) => [x.type, x.value])); return `${p.hour}:${p.minute}`; } };
const fmtJour = new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const ORDRE = { in: 0, pre: 1, post: 2 };
const QUART = (p) => (p <= 4 ? `${p}${p === 1 ? "er" : "e"} quart` : "Prolongation");

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function statut(ev) {
  const st = ev.status, t = st.type, c = ev.competitions[0];
  if (t.state === "in") {
    const txt = t.name === "STATUS_HALFTIME" ? "Mi-temps"
      : t.name === "STATUS_END_PERIOD" ? `Fin du ${QUART(st.period)}`
      : `${QUART(st.period)} · ${st.displayClock}`;
    return { cls: "in", badge: "EN COURS", txt };
  }
  if (t.state === "post") return { cls: "post", badge: st.period > 4 ? "FINAL (PROL.)" : "FINAL", txt: fmtJour.format(new Date(ev.date)) };
  if (t.name === "STATUS_POSTPONED") return { cls: "pre", badge: "REPORTÉ", txt: "" };
  const d = new Date(ev.date);
  return { cls: "pre", badge: "À VENIR", txt: `${fmtJour.format(d)} · ${fmtHeure.format(d)}` };
}

function tele(c) {
  const n = (c.broadcasts || []).flatMap((b) => b.names || []);
  if (n.length) return [...new Set(n)].join(", ");
  return (c.geoBroadcasts || []).map((g) => g.media?.shortName).filter(Boolean).join(", ");
}

function equipe(comp, c, state, possId) {
  const t = comp.team, fav = FAVORIS.includes(t.abbreviation);
  const rec = comp.records?.find((r) => r.type === "total")?.summary || "";
  const lose = state === "post" && comp.winner === false, win = state === "post" && comp.winner === true;
  const logo = t.logo || `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${t.abbreviation.toLowerCase()}.png`;
  return `<div class="team ${fav ? "favteam" : ""} ${lose ? "lose" : ""} ${win ? "win" : ""}">
    <img src="${esc(logo)}" alt="" loading="lazy">
    <span class="name">${esc(t.shortDisplayName || t.displayName)}${possId === t.id ? ' <span class="poss" role="img" aria-label="Possession" title="Possession">🏈</span>' : ""}<span class="rec">${esc(rec)}</span></span>
    <span class="score">${state === "pre" ? "" : esc(comp.score)}</span>
  </div>`;
}

function essai(sit) {
  if (!sit.down || sit.down < 1) return "";
  const goal = /goal/i.test(sit.shortDownDistanceText || sit.downDistanceText || "");
  const d = `${sit.down === 1 ? "1er" : sit.down + "e"} & ${goal ? "but" : sit.distance}`;
  return sit.possessionText ? `${d} · ${sit.possessionText}` : d;
}

function carte(ev) {
  const c = ev.competitions[0], s = statut(ev), state = ev.status.type.state;
  const away = c.competitors.find((x) => x.homeAway === "away"), home = c.competitors.find((x) => x.homeAway === "home");
  const fav = c.competitors.some((x) => FAVORIS.includes(x.team.abbreviation));
  const sit = c.situation || {};
  const cote = c.odds?.[0];
  const meta = [];
  if (cote?.details) meta.push(`📊 Ligne : ${esc(cote.details)}${cote.overUnder ? ` · O/U ${esc(cote.overUnder)}` : ""}`);
  const tv = tele(c); if (tv) meta.push(`📺 ${esc(tv)}`);
  return `<article class="carte ${s.cls === "in" ? "live" : ""} ${fav ? "fav" : ""}" aria-label="${esc(away.team.shortDisplayName)} contre ${esc(home.team.shortDisplayName)}, ${esc(s.badge.toLowerCase())}">
    <div class="status"><span class="badge ${s.cls}">${s.badge}</span><span class="quand">${esc(s.txt)}</span></div>
    ${equipe(away, c, state, sit.possession)}
    ${equipe(home, c, state, sit.possession)}
    ${state === "in" && essai(sit) ? `<div class="situation">${esc(essai(sit))}${sit.isRedZone ? " · 🔴 zone payante" : ""}</div>` : ""}
    ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join("")}</div>` : ""}
  </article>`;
}

function trier(evs) {
  return [...evs].sort((a, b) => (ORDRE[a.status.type.state] - ORDRE[b.status.type.state]) || (new Date(a.date) - new Date(b.date)));
}

async function recuperer() {
  let derniere;
  for (const url of SOURCES) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { derniere = e; }
  }
  throw derniere;
}

let toastTimer;
function toast(msg, err) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false; t.className = `toast ${err ? "err" : ""}`;
  requestAnimationFrame(() => t.classList.add("visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove("visible"); setTimeout(() => { t.hidden = true; }, 300); }, 2600);
}

async function charger(manuel = false) {
  $("dot").className = "dot busy";
  $("reload").classList.add("tourne"); $("reload").setAttribute("aria-busy", "true");
  try {
    const data = await recuperer();
    const evs = trier(data.events || []);
    const isFav = (e) => e.competitions[0].competitors.some((x) => FAVORIS.includes(x.team.abbreviation));
    const favs = evs.filter(isFav);
    const bye = (data.week?.teamsOnBye || []).filter((t) => FAVORIS.includes(t.abbreviation));
    $("favs").innerHTML = favs.map(carte).join("") +
      bye.map((t) => `<div class="carte fav"><div class="team favteam"><img src="${esc(t.logo)}" alt=""><span class="name">${esc(t.shortDisplayName)}</span><span class="rec">Semaine de congé</span></div></div>`).join("") ||
      `<p class="vide">Pas de match des Patriots ou des Bills cette semaine.</p>`;
    $("games").innerHTML = evs.filter((e) => !isFav(e)).map(carte).join("") || `<p class="vide">Aucun match.</p>`;
    const nLive = evs.filter((e) => e.status.type.state === "in").length;
    const typ = { 1: "Préparatoire", 2: "Saison", 3: "Séries" }[data.season?.type] || "";
    $("week").textContent = `${typ} ${data.season?.year ?? ""} · Semaine ${data.week?.number ?? "?"}${nLive ? ` · ${nLive} en cours` : ""}`;
    $("updated").textContent = `Mis à jour à ${fmtHeure.format(new Date())}`;
    $("error").hidden = true;
    $("count").textContent = `${evs.length} match${evs.length > 1 ? "s" : ""}`;
    $("dot").className = "dot";
    if (manuel) toast(`✅ Pointages à jour (${fmtHeure.format(new Date())})`);
  } catch (e) {
    $("error").textContent = `Impossible de charger les pointages (${e.message}). Nouvel essai dans 30 s.`;
    $("error").hidden = false;
    $("dot").className = "dot err";
    if (manuel) toast("⚠️ Échec du rafraîchissement", true);
  } finally {
    $("reload").classList.remove("tourne"); $("reload").removeAttribute("aria-busy");
  }
}

$("reload").addEventListener("click", () => charger(true));
document.addEventListener("visibilitychange", () => { if (!document.hidden) charger(); });
charger();
setInterval(charger, REFRESH_MS);
