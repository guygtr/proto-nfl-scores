// Pointage NFL en direct — prototype. Aucune clé requise.
// 1) proxy local (server.py) ; 2) ESPN direct en secours (CORS pas toujours présent chez ESPN)
const SOURCES = ["/api/scoreboard", "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"];
const FAVORIS_DEFAUT = ["NE", "BUF"]; // Patriots et Bills si rien n'est sauvegardé
const CLE_FAVORIS = "pointage-nfl:equipes";
// Liste statique des 32 équipes (abréviations ESPN), groupées par division.
// L'API teams d'ESPN ne renvoie pas d'en-tête CORS : on évite donc un appel de plus.
const DIVISIONS = [
  ["AFC Est", [["BUF","Buffalo Bills"],["MIA","Miami Dolphins"],["NE","New England Patriots"],["NYJ","New York Jets"]]],
  ["AFC Nord", [["BAL","Baltimore Ravens"],["CIN","Cincinnati Bengals"],["CLE","Cleveland Browns"],["PIT","Pittsburgh Steelers"]]],
  ["AFC Sud", [["HOU","Houston Texans"],["IND","Indianapolis Colts"],["JAX","Jacksonville Jaguars"],["TEN","Tennessee Titans"]]],
  ["AFC Ouest", [["DEN","Denver Broncos"],["KC","Kansas City Chiefs"],["LV","Las Vegas Raiders"],["LAC","Los Angeles Chargers"]]],
  ["NFC Est", [["DAL","Dallas Cowboys"],["NYG","New York Giants"],["PHI","Philadelphia Eagles"],["WSH","Washington Commanders"]]],
  ["NFC Nord", [["CHI","Chicago Bears"],["DET","Detroit Lions"],["GB","Green Bay Packers"],["MIN","Minnesota Vikings"]]],
  ["NFC Sud", [["ATL","Atlanta Falcons"],["CAR","Carolina Panthers"],["NO","New Orleans Saints"],["TB","Tampa Bay Buccaneers"]]],
  ["NFC Ouest", [["ARI","Arizona Cardinals"],["LAR","Los Angeles Rams"],["SF","San Francisco 49ers"],["SEA","Seattle Seahawks"]]],
];
const EQUIPES = Object.fromEntries(DIVISIONS.flatMap(([, l]) => l));
const logoEquipe = (ab) => `https://a.espncdn.com/i/teamlogos/nfl/500/${ab.toLowerCase()}.png`;
function lireFavoris() {
  const p = new URLSearchParams(location.search).get("equipes");
  if (p !== null) {
    const l = p.split(",").map((s) => s.trim().toUpperCase()).filter((s) => EQUIPES[s]);
    try { localStorage.setItem(CLE_FAVORIS, JSON.stringify(l)); } catch {}
    return l;
  }
  try { const s = JSON.parse(localStorage.getItem(CLE_FAVORIS)); if (Array.isArray(s)) return s.filter((x) => EQUIPES[x]); } catch {}
  return [...FAVORIS_DEFAUT];
}
let FAVORIS = lireFavoris();
let derniereData = null;
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
    derniereData = await recuperer();
    afficher(derniereData);
    $("updated").textContent = `Mis à jour à ${fmtHeure.format(new Date())}`;
    $("error").hidden = true;
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

function nomsFavoris() {
  const n = FAVORIS.map((a) => EQUIPES[a]?.split(" ").pop()).filter(Boolean);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} ou ${n[n.length - 1]}`;
}

function afficher(data) {
    if (!FAVORIS.length) {
      $("favs").innerHTML = `<div class="vide">Aucune équipe favorite pour l'instant.<br><button type="button" class="btn-neon choisir" data-ouvrir-equipes>⭐ Choisir mes équipes</button></div>`;
    }
    const evs = trier(data.events || []);
    const isFav = (e) => e.competitions[0].competitors.some((x) => FAVORIS.includes(x.team.abbreviation));
    const favs = evs.filter(isFav);
    const bye = (data.week?.teamsOnBye || []).filter((t) => FAVORIS.includes(t.abbreviation));
    if (FAVORIS.length) $("favs").innerHTML = favs.map(carte).join("") +
      bye.map((t) => `<div class="carte fav"><div class="team favteam"><img src="${esc(t.logo)}" alt=""><span class="name">${esc(t.shortDisplayName)}</span><span class="rec">Semaine de congé</span></div></div>`).join("") ||
      `<p class="vide">Pas de match des ${esc(nomsFavoris())} cette semaine.</p>`;
    $("games").innerHTML = evs.filter((e) => !isFav(e)).map(carte).join("") || `<p class="vide">Aucun match.</p>`;
    const nLive = evs.filter((e) => e.status.type.state === "in").length;
    const typ = { 1: "Préparatoire", 2: "Saison", 3: "Séries" }[data.season?.type] || "";
    $("week").textContent = `${typ} ${data.season?.year ?? ""} · Semaine ${data.week?.number ?? "?"}${nLive ? ` · ${nLive} en cours` : ""}`;
    $("count").textContent = `${evs.length} match${evs.length > 1 ? "s" : ""}`;
}

// ---------- Panneau « Mes équipes » ----------
const panneau = $("panneau-equipes");
let declencheur = null;
function construireListe() {
  $("liste-equipes").innerHTML = DIVISIONS.map(([div, l]) => `<fieldset class="division"><legend>${div}</legend>${l.map(([ab, nom]) => `
    <label class="choix" data-nom="${esc((nom + " " + ab).toLowerCase())}">
      <input type="checkbox" value="${ab}" ${FAVORIS.includes(ab) ? "checked" : ""}>
      <img src="${logoEquipe(ab)}" alt="" loading="lazy" width="32" height="32">
      <span>${esc(nom)}</span>
    </label>`).join("")}</fieldset>`).join("");
  majCompte();
}
function cases() { return [...$("liste-equipes").querySelectorAll("input[type=checkbox]")]; }
function majCompte() { const n = cases().filter((c) => c.checked).length; $("compte-equipes").textContent = `${n} sélectionnée${n > 1 ? "s" : ""}`; }
function filtrer() {
  const q = $("recherche-equipes").value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let vus = 0;
  $("liste-equipes").querySelectorAll(".division").forEach((f) => {
    let n = 0;
    f.querySelectorAll(".choix").forEach((l) => { const ok = !q || l.dataset.nom.includes(q); l.hidden = !ok; if (ok) n++; });
    f.hidden = !n; vus += n;
  });
  $("aucun-resultat").hidden = vus > 0;
}
function focusables() { return [...panneau.querySelectorAll("button, input, [href]")].filter((e) => !e.disabled && e.offsetParent !== null); }
function ouvrirPanneau(e) {
  declencheur = e?.currentTarget || document.activeElement;
  construireListe(); $("recherche-equipes").value = ""; filtrer();
  panneau.hidden = false; document.body.classList.add("fige");
  requestAnimationFrame(() => { panneau.classList.add("ouvert"); $("recherche-equipes").focus(); });
}
function fermerPanneau() {
  panneau.classList.remove("ouvert"); panneau.hidden = true; document.body.classList.remove("fige");
  (declencheur && document.contains(declencheur) ? declencheur : $("btn-equipes")).focus();
}
function sauver() {
  FAVORIS = cases().filter((c) => c.checked).map((c) => c.value);
  try { localStorage.setItem(CLE_FAVORIS, JSON.stringify(FAVORIS)); } catch {}
  const u = new URL(location.href); u.searchParams.set("equipes", FAVORIS.join(",")); history.replaceState(null, "", u);
  fermerPanneau();
  if (derniereData) afficher(derniereData);
  toast(FAVORIS.length ? `⭐ Équipes enregistrées (${FAVORIS.length})` : "⭐ Aucune équipe favorite");
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-ouvrir-equipes]"); if (b) { ouvrirPanneau({ currentTarget: b }); } });
$("btn-equipes").addEventListener("click", ouvrirPanneau);
$("fermer-equipes").addEventListener("click", fermerPanneau);
$("annuler-equipes").addEventListener("click", fermerPanneau);
$("sauver-equipes").addEventListener("click", sauver);
$("tout-effacer").addEventListener("click", () => { cases().forEach((c) => { c.checked = false; }); majCompte(); });
$("liste-equipes").addEventListener("change", majCompte);
$("recherche-equipes").addEventListener("input", filtrer);
panneau.addEventListener("click", (e) => { if (e.target === panneau) fermerPanneau(); });
panneau.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.preventDefault(); fermerPanneau(); return; }
  if (e.key !== "Tab") return;
  const f = focusables(); if (!f.length) return;
  const premier = f[0], dernier = f[f.length - 1];
  if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
  else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
});

$("reload").addEventListener("click", () => charger(true));
document.addEventListener("visibilitychange", () => { if (!document.hidden) charger(); });
charger();
setInterval(charger, REFRESH_MS);
