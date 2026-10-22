// Active Matter Field Guide — loads data/*.json and renders the tabs.
const TYPES = {
  wpn:  { n: "Weapons",             c: "--wpn"  },
  med:  { n: "Medical",             c: "--med"  },
  val:  { n: "Valuables",           c: "--val"  },
  key:  { n: "Locked / key",        c: "--key"  },
  boss: { n: "Boss / heavy threat", c: "--boss" },
  exit: { n: "Exits",               c: "--exit" }
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = iso => { const d = new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")); return isNaN(d) ? iso : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); };
const getJSON = p => fetch(p + "?v=" + Date.now()).then(r => { if (!r.ok) throw new Error(p + " " + r.status); return r.json(); });

/* ---------- Tabs ---------- */
const tabs = [...document.querySelectorAll("nav.tabs button")];
function show(v) {
  tabs.forEach(t => { const on = t.dataset.view === v; t.setAttribute("aria-selected", on); document.getElementById(t.dataset.view).hidden = !on; });
}
tabs.forEach(t => t.addEventListener("click", () => { show(t.dataset.view); history.replaceState(null, "", "#" + t.dataset.view); }));
const PICK = location.hash === "#pick";
const startView = PICK ? "map" : location.hash.slice(1);
if (["news", "guide", "map", "tiers", "threats", "keys"].includes(startView)) show(startView);

/* ---------- News ---------- */
getJSON("data/news.json").then(data => {
  const items = data.items || [];
  document.getElementById("newsStamp").textContent = fmtDate((data.updated || "").slice(0, 10));
  const latest = items[0];
  if (latest) {
    document.getElementById("latest").innerHTML =
      `<div class="eyebrow">Newest · ${esc(fmtDate(latest.date))}</div><h3>${esc(latest.title)}</h3><p>${esc(latest.summary)}</p>` +
      `<a href="${esc(latest.url)}" target="_blank" rel="noopener">Read the full post →</a>`;
    const ver = (items.find(i => /\d+\.\d+\.\d+\.\d+/.test(i.title)) || {}).title?.match(/\d+\.\d+\.\d+\.\d+/);
    if (ver) document.getElementById("buildStamp").textContent = "build " + ver[0];
  }
  document.getElementById("timeline").innerHTML = items.slice(1).map(n =>
    `<li><div class="date">${esc(fmtDate(n.date))}</div><div class="body"><span class="tag ${n.kind === "patch" ? "patch" : "news"}">${n.kind === "patch" ? "Patch" : "News"}</span>` +
    `<a href="${esc(n.url)}" target="_blank" rel="noopener"><b>${esc(n.title)}</b></a><p>${esc(n.summary)}</p></div></li>`).join("");
}).catch(e => { document.getElementById("latest").innerHTML = `<p>Couldn't load the news feed (${esc(e.message)}). Check the official site linked below.</p>`; });

/* ---------- Loot map ---------- */
let MAPS = [], curMap = null, sel = 0, HL = null;
const INDEX = {};
const active = new Set(Object.keys(TYPES));
const ms = document.getElementById("mapsel"), fl = document.getElementById("filters");
const canvas = document.getElementById("canvas"), svg = document.getElementById("svg");
const img = document.getElementById("mapimg"), note = document.getElementById("mapnote");
if (PICK) { document.getElementById("picker").hidden = false; canvas.classList.add("picking"); }

Object.entries(TYPES).forEach(([k, v]) => {
  const b = document.createElement("button");
  b.className = "chip"; b.setAttribute("aria-pressed", "true");
  b.innerHTML = `<span class="dot" style="background:var(${v.c})"></span>${v.n}`;
  b.onclick = () => { active.has(k) ? active.delete(k) : active.add(k); b.setAttribute("aria-pressed", active.has(k)); draw(); };
  fl.appendChild(b);
});

function selectMap(m, pick) {
  curMap = m; sel = pick ?? 0;
  [...ms.children].forEach(b => b.setAttribute("aria-selected", b.dataset.id === m.id));
  document.getElementById("mapsummary").textContent = m.summary;
  if (m.image) {
    img.onload = () => { canvas.classList.add("has-img"); img.hidden = false; note.textContent = "In-game map · approximate marker positions"; draw(); };
    img.onerror = () => { img.hidden = true; canvas.classList.remove("has-img"); note.textContent = "Schematic · route order, not exact positions"; draw(); };
    img.src = m.image;
  } else {
    img.removeAttribute("src"); img.hidden = true; canvas.classList.remove("has-img");
    note.textContent = "Schematic · route order, not exact positions";
    draw();
  }
}

function draw() {
  const m = curMap; if (!m) return;
  const useImg = !img.hidden && img.naturalWidth;
  const W = useImg ? img.naturalWidth : 400, H = useImg ? img.naturalHeight : 260, s = W / 400;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  let h = "";
  if (!useImg) {
    for (let x = 20; x < 400; x += 40) h += `<line x1="${x}" y1="0" x2="${x}" y2="260" stroke="var(--grid)"/>`;
    for (let y = 20; y < 260; y += 40) h += `<line x1="0" y1="${y}" x2="400" y2="${y}" stroke="var(--grid)"/>`;
  }
  const P = n => [n.x / 100 * W, n.y / 100 * H];
  (m.links || []).forEach(([a, b]) => {
    const A = m.nodes[a], B = m.nodes[b]; if (!A || !B || !active.has(A.type) || !active.has(B.type)) return;
    const [x1, y1] = P(A), [x2, y2] = P(B);
    h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--muted)" stroke-width="${1.5 * s}" stroke-dasharray="${5 * s} ${5 * s}" opacity=".75"/>`;
  });
  m.nodes.forEach((n, i) => {
    if (!active.has(n.type)) return;
    const [x, y] = P(n), c = `var(${TYPES[n.type].c})`, right = n.x > 72;
    if (n.type === "exit") {
      const r = 7 * s;
      h += `<g class="marker exit${i === sel ? " sel" : ""}${HL ? " dim" : ""}" tabindex="0" role="button" aria-label="Exit" data-i="${i}">` +
        `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="${2 * s}" fill="${c}" style="stroke-width:${(i === sel ? 3 : 1.5) * s}"/>` +
        `<path d="M${x - 3 * s} ${y}h${6 * s}m${-2.5 * s} ${-2.5 * s}l${2.5 * s} ${2.5 * s}l${-2.5 * s} ${2.5 * s}" stroke="var(--panel)" stroke-width="${1.6 * s}" fill="none"/></g>`;
      return;
    }
    const hit = HL && (n.items || []).includes(HL);
    h += `<g class="marker${i === sel ? " sel" : ""}${HL && !hit ? " dim" : ""}" tabindex="0" role="button" aria-label="${esc(n.label)}" data-i="${i}">` +
      (hit ? `<circle class="pulse" cx="${x}" cy="${y}" r="${16 * s}" stroke="${c}" style="stroke-width:${3 * s}"/>` : "") +
      `<circle class="ring" cx="${x}" cy="${y}" r="${10 * s}" stroke="${c}" style="stroke-width:${(i === sel ? 4 : 2.5) * s}"/>` +
      `<circle cx="${x}" cy="${y}" r="${4 * s}" fill="${c}"/>` +
      `<text x="${right ? x - 16 * s : x + 16 * s}" y="${y + 4 * s}" text-anchor="${right ? "end" : "start"}" style="font-size:${11 * s}px;stroke-width:${3 * s}px">${esc(n.label)}</text></g>`;
  });
  svg.innerHTML = h;
  svg.querySelectorAll(".marker").forEach(g => {
    const go = e => { e.stopPropagation(); sel = +g.dataset.i; draw(); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } });
  });
  let n = m.nodes[sel];
  const det = document.getElementById("detail");
  if (!n || !active.has(n.type)) {
    const f = m.nodes.findIndex(x => active.has(x.type));
    if (f < 0) { det.innerHTML = `<p class="eyebrow">No markers match the filters</p>`; return; }
    sel = f; return draw();
  }
  const ty = TYPES[n.type];
  det.innerHTML = `<div class="eyebrow">${esc(m.name)}</div><h3>${esc(n.label)}</h3><span class="pill" style="color:var(${ty.c})">${ty.n}</span>` +
    `<dl><dt>Loot</dt><dd>${esc(n.loot)}</dd><dt>Access</dt><dd>${esc(n.access)}</dd><dt>Danger</dt><dd>${esc(n.danger)}</dd>${n.tip ? `<dt>Tip</dt><dd>${esc(n.tip)}</dd>` : ""}</dl>` +
    ((n.items || []).length ? `<div><div class="eyebrow">Gear here · tap to find elsewhere</div><div class="itemchips">${n.items.map(it => `<button class="ichip${it === HL ? " on" : ""}" data-find="${esc(it)}">${esc(it)}</button>`).join("")}</div></div>` : "");
}

canvas.addEventListener("click", e => {
  if (!PICK) return;
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width * 100).toFixed(1), y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
  const out = `"x":${x},"y":${y}`;
  document.getElementById("pickout").textContent = out;
  navigator.clipboard?.writeText(out).catch(() => {});
});

getJSON("data/loot.json").then(data => {
  MAPS = data.maps || [];
  MAPS.forEach(m => {
    const b = document.createElement("button");
    b.textContent = m.name; b.setAttribute("role", "tab"); b.dataset.id = m.id;
    b.onclick = () => selectMap(m);
    ms.appendChild(b);
  });
  document.getElementById("lootStamp").textContent = data.updated || "";
  CATS = data.categories || {}; COMMON = data.common || {};
  MAPS.forEach(m => m.nodes.forEach((n, i) => (n.items || []).forEach(it => (INDEX[it] ||= []).push({ map: m.id, i, type: n.type }))));
  renderFinder();
  refreshFindLinks();
  if (MAPS[0]) selectMap(MAPS[0]);
}).catch(e => { document.getElementById("detail").textContent = "Couldn't load loot data: " + e.message; });

/* ---------- Keys ---------- */
let KEYS = [];
const q = document.getElementById("keyq"), mapf = document.getElementById("keymap");
const cell = v => (!v || /^(\?|unknown|unconfirmed)$/i.test(v)) ? `<span class="unk">${esc(v === "?" || !v ? "Unknown" : v)}</span>` : esc(v);
function drawKeys() {
  const term = q.value.trim().toLowerCase(), mp = mapf.value;
  const rows = KEYS.filter(k => (!mp || k.map.includes(mp)) && (!term || Object.values(k).join(" ").toLowerCase().includes(term)));
  document.getElementById("keyrows").innerHTML = rows.map(k =>
    `<tr><td>${esc(k.name)}<div class="eyebrow" style="margin-top:2px">${esc(k.map)}</div><button class="findlink" data-find="${esc(k.name)}" hidden>Show on map →</button></td><td>${cell(k.opens)}</td><td>${cell(k.found)}</td><td>${cell(k.craft)}</td><td>${cell(k.loot)}</td><td>${cell(k.uses)}</td>` +
    `<td>${k.source ? `<a href="${esc(k.source)}" target="_blank" rel="noopener">wiki</a>` : ""}</td></tr>`).join("") ||
    `<tr><td colspan="7" class="unk">No keys match.</td></tr>`;
  document.getElementById("keycount").textContent = `${rows.length} of ${KEYS.length} keys`;
  refreshFindLinks();
}
getJSON("data/keys.json").then(data => {
  KEYS = data.keys || [];
  document.getElementById("keynote").textContent = data.notes || "";
  const maps = [...new Set(KEYS.flatMap(k => k.map.split(" / ")))].sort();
  mapf.innerHTML = `<option value="">All maps</option>` + maps.map(m => `<option>${esc(m)}</option>`).join("");
  drawKeys();
}).catch(e => { document.getElementById("keyrows").innerHTML = `<tr><td colspan="7">Couldn't load key data: ${esc(e.message)}</td></tr>`; });
q.addEventListener("input", drawKeys);
mapf.addEventListener("change", drawKeys);

/* ---------- Priorities ---------- */
const TV = { S: 4, A: 3, B: 2, C: 1 }, VT = ["?", "C", "B", "A", "S"];
document.querySelectorAll(".subtabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".subtabs button").forEach(x => { const on = x === b; x.setAttribute("aria-selected", on); document.getElementById(x.dataset.sub).hidden = !on; });
}));
let TIERS = null;
const wclass = document.getElementById("wclass");
function drawTiers() {
  const srcs = TIERS.sources || {}, cls = wclass.value;
  const ws = (TIERS.weapons || []).filter(w => !cls || w.class === cls).map(w => {
    const vals = Object.values(w.tiers || {}).map(t => TV[t]).filter(Boolean);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { ...w, avg, tier: VT[Math.round(avg)] || "?" };
  }).sort((a, b) => b.avg - a.avg || Object.keys(b.tiers).length - Object.keys(a.tiers).length);
  document.getElementById("tierboard").innerHTML = ["S", "A", "B", "C", "?"].map(t => {
    const list = ws.filter(w => w.tier === t); if (!list.length) return "";
    return `<div class="tierrow" data-t="${t}"><div class="tierlabel">${t === "?" ? "–" : t}</div><div class="tiercards">` + list.map(w =>
      `<div class="wcard"><div class="top"><b>${esc(w.name)}</b><span class="cls">${esc(w.class)}</span></div>` +
      `<div class="votes">${Object.entries(w.tiers).map(([s, v]) => `<span class="vote">${esc((srcs[s]?.name || s).replace(/\..*$/, ""))} <b>${esc(v)}</b></span>`).join("") || `<span class="vote">unranked</span>`}</div>` +
      `<p>${esc(w.why)}</p><button class="findlink" data-find="${esc(w.name)}" hidden>Find on map →</button></div>`).join("") + `</div></div>`;
  }).join("");
  refreshFindLinks();
}
getJSON("data/tiers.json").then(data => {
  TIERS = data;
  document.getElementById("tierStamp").textContent = data.updated || "";
  const classes = [...new Set((data.weapons || []).map(w => w.class))].sort();
  wclass.innerHTML = `<option value="">All classes</option>` + classes.map(c => `<option>${esc(c)}</option>`).join("");
  wclass.addEventListener("change", drawTiers);
  drawTiers();
  document.getElementById("patchbox").innerHTML = `<h3>Recent balance changes</h3><ul>` +
    (data.patchNotes || []).map(p => `<li><b>${esc(p.patch)}</b> — ${esc(p.change)}</li>`).join("") + `</ul>`;
  const md = data.mods;
  if (md) document.getElementById("mods").innerHTML =
    `<p class="keynote">Fit mods in this order when credits are tight.</p><ol class="modlist">` +
    md.order.map(o => `<li><h3>${esc(o.slot)}</h3><p>${esc(o.why)}</p><ul>${o.picks.map(p => `<li>${esc(p)}</li>`).join("")}</ul></li>`).join("") + `</ol>` +
    `<div class="modbuilds"><h3>Builds by role</h3><table class="data"><tbody>${md.builds.map(b => `<tr><td>${esc(b.role)}</td><td>${esc(b.build)}</td></tr>`).join("")}</tbody></table></div>` +
    `<div class="rules"><h3>Modding tips</h3><ul>${md.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  document.getElementById("lootcols").innerHTML = (data.loot || []).map((b, i) =>
    `<div class="bucket" data-b="${i}"><h3>${esc(b.bucket)}</h3><ul>` + b.items.map(it => `<li><b>${esc(it.name)}</b><span>${esc(it.why)}</span>${it.find ? `<button class="findlink" data-find="${esc(it.find)}" hidden>Find on map →</button>` : ""}</li>`).join("") + `</ul></div>`).join("");
  document.getElementById("gearcols").innerHTML = (data.gear || []).map(g =>
    `<div class="bucket"><h3>${esc(g.group)}</h3>${/^Getting/.test(g.group) ? "" : `<p class="eyebrow">Best first</p>`}<ul class="gearlist">` + g.rows.map(r => `<li><b>${esc(r.name)}</b><span>${esc(r.note)}</span>${r.find ? `<button class="findlink" data-find="${esc(r.find)}" hidden>Find on map →</button>` : ""}</li>`).join("") + `</ul></div>`).join("");
  refreshFindLinks();
}).catch(e => { document.getElementById("tierboard").textContent = "Couldn't load tier data: " + e.message; });


/* ---------- Gear finder ---------- */
let CATS = {}, COMMON = {};
const cinfo = it => { const c = COMMON[it]; return !c ? null : typeof c === "string" ? { note: c, badge: "everywhere" } : c; };
function catOf(it) {
  for (const [c, list] of Object.entries(CATS)) if (list.includes(it)) return c;
  return /key|board/i.test(it) ? "Keys & locks" : "Other";
}
function renderFinder() {
  const q = (document.getElementById("findq").value || "").trim().toLowerCase();
  const all = [...new Set([...Object.keys(INDEX), ...Object.keys(COMMON)])].sort((a, b) => a.localeCompare(b));
  const items = all.filter(it => !q || it.toLowerCase().includes(q));
  const groups = {};
  items.forEach(it => (groups[catOf(it)] ||= []).push(it));
  Object.entries(groups).forEach(([c, list]) => { const ord = CATS[c] || []; list.sort((a, b) => ((ord.indexOf(a) + 1) || 999) - ((ord.indexOf(b) + 1) || 999) || a.localeCompare(b)); });
  const order = [...Object.keys(CATS), "Other"].filter(c => groups[c]);
  document.getElementById("findgroups").innerHTML = order.map(c => {
    const open = q || groups[c].includes(HL);
    return `<details class="fgroup"${open ? " open" : ""}><summary><span>${esc(c)}</span><span class="fcount">${groups[c].length}</span></summary><div class="itemchips">` +
      groups[c].map(it => {
        const n = (INDEX[it] || []).length;
        return `<button class="ichip${it === HL ? " on" : ""}" data-find="${esc(it)}">${esc(it)} <span>${cinfo(it) ? (n ? n + " + " + cinfo(it).badge : cinfo(it).badge) : n}</span></button>`;
      }).join("") + `</div></details>`;
  }).join("") || `<p class="unk">Nothing matches “${esc(q)}”.</p>`;
}
document.getElementById("findq").addEventListener("input", renderFinder);

function findItem(item) {
  const hits = INDEX[item];
  show("map"); history.replaceState(null, "", "#map");
  if (!hits) { HL = COMMON[item] ? item : null; draw(); renderFinder(); renderFindBar(item); return; }
  HL = item;
  hits.forEach(h => { if (!active.has(h.type)) { active.add(h.type); } });
  [...fl.children].forEach((b, k) => b.setAttribute("aria-pressed", active.has(Object.keys(TYPES)[k])));
  const here = hits.find(h => h.map === curMap?.id) || hits[0];
  const m = MAPS.find(x => x.id === here.map);
  if (m !== curMap) selectMap(m, here.i); else { sel = here.i; draw(); }
  renderFinder(); renderFindBar();
  canvas.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}
function renderFindBar(missing) {
  const bar = document.getElementById("findbar");
  if (missing) {
    bar.hidden = false;
    bar.innerHTML = COMMON[missing]
      ? `<div class="fnote"><b>${esc(missing)}</b> · ${esc(cinfo(missing).badge)}. ${esc(cinfo(missing).note)}</div><button data-clear>Clear</button>`
      : `No map spots logged for <b>${esc(missing)}</b> yet. <button data-clear>Clear</button>`;
    return;
  }
  if (!HL) { bar.hidden = true; return; }
  const per = {}; INDEX[HL].forEach(h => (per[h.map] = per[h.map] || []).push(h.i));
  bar.hidden = false;
  bar.innerHTML = `Showing <b>${esc(HL)}</b> · ${INDEX[HL].length} spot${INDEX[HL].length > 1 ? "s" : ""}: ` +
    Object.entries(per).map(([id, idx]) => { const m = MAPS.find(x => x.id === id);
      return `<button class="mapjump${curMap && curMap.id === id ? " on" : ""}" data-jump="${id}" data-i="${idx[0]}">${esc(m.name)} (${idx.length})</button>`; }).join("") +
    ` <button data-clear>Clear</button>` + (cinfo(HL) ? `<div class="fnote">${esc(cinfo(HL).note)}</div>` : "");
}
function refreshFindLinks() {
  document.querySelectorAll("[data-find]").forEach(el => { if (!el.classList.contains("ichip")) el.hidden = !(INDEX[el.dataset.find] || COMMON[el.dataset.find]); });
}
document.addEventListener("click", e => {
  const f = e.target.closest("[data-find]");
  if (f) {
    e.preventDefault();
    if (f.classList.contains("ichip") && f.dataset.find === HL) { HL = null; renderFindBar(); renderFinder(); draw(); return; }
    findItem(f.dataset.find); return;
  }
  const j = e.target.closest("[data-jump]");
  if (j) { const m = MAPS.find(x => x.id === j.dataset.jump); selectMap(m, +j.dataset.i); renderFindBar(); return; }
  if (e.target.closest("[data-clear]")) { HL = null; renderFindBar(); renderFinder(); draw(); return; }
  const g = e.target.closest("[data-gomap]");
  if (g) { const m = MAPS.find(x => x.id === g.dataset.gomap); if (m) { HL = null; renderFindBar(); show("map"); history.replaceState(null, "", "#map"); selectMap(m); canvas.scrollIntoView({ block: "center" }); } }
});

/* ---------- Threats ---------- */
let THREATS = null, tCounter = "";
const tq = document.getElementById("threatq");
const openThreats = new Set();
function drawThreats() {
  const q = tq.value.trim().toLowerCase();
  const list = THREATS.threats.filter(t => (!tCounter || t.counters.includes(tCounter)) && (!q || JSON.stringify(t).toLowerCase().includes(q)));
  document.getElementById("threatcount").textContent = `${list.length} of ${THREATS.threats.length}`;
  document.getElementById("threatcards").innerHTML = list.map(t =>
    `<details class="tcard" data-kind="${esc(t.kind)}" data-name="${esc(t.name)}"${openThreats.has(t.name) ? " open" : ""}>` +
    `<summary><div class="ttop"><h3>${esc(t.name)}</h3><span class="kind">${esc(t.kind)}</span></div>` +
    `<div class="tsum"><div class="danger" aria-label="Danger ${t.danger} of 4">${[1, 2, 3, 4].map(k => `<i class="${k <= t.danger ? "on" : ""}"></i>`).join("")}</div>` +
    `<div class="tcounters">${t.counters.map(c => `<span class="cchip">${esc(c)}</span>`).join("")}</div></div></summary>` +
    `<div class="tbody"><p class="does">${esc(t.does)}</p><div class="eyebrow">How to beat it</div><ul>${t.beat.map(b => `<li>${esc(b)}</li>`).join("")}</ul>` +
    `<p class="drops"><b>Drops:</b> ${esc(t.drops)}</p>` +
    (t.where.length ? `<div class="twhere">Seen on: ${t.where.map(id => { const m = MAPS.find(x => x.id === id); return m ? `<button data-gomap="${id}">${esc(m.name)}</button>` : ""; }).join("")}</div>` : "") +
    `</div></details>`).join("") || `<p class="unk">No threats match.</p>`;
  document.querySelectorAll("#threatcards details").forEach(d => d.addEventListener("toggle", () => { d.open ? openThreats.add(d.dataset.name) : openThreats.delete(d.dataset.name); syncExpand(); }));
  syncExpand();
}
function syncExpand() {
  const ds = [...document.querySelectorAll("#threatcards details")];
  document.getElementById("expandall").textContent = ds.length && ds.every(d => d.open) ? "Collapse all" : "Expand all";
}
document.getElementById("expandall").addEventListener("click", () => {
  const ds = [...document.querySelectorAll("#threatcards details")], open = !ds.every(d => d.open);
  ds.forEach(d => { d.open = open; open ? openThreats.add(d.dataset.name) : openThreats.delete(d.dataset.name); });
  syncExpand();
});
getJSON("data/threats.json").then(data => {
  THREATS = data;
  document.getElementById("threatStamp").textContent = data.updated || "";
  document.getElementById("rules").innerHTML = data.rules.map(r => `<li>${esc(r)}</li>`).join("");
  const counters = [...new Set(data.threats.flatMap(t => t.counters))].sort();
  const box = document.getElementById("countchips");
  box.innerHTML = `<button class="chip" aria-pressed="true" data-c="">All</button>` + counters.map(c => `<button class="chip" aria-pressed="false" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  box.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; tCounter = b.dataset.c; box.querySelectorAll("[data-c]").forEach(x => x.setAttribute("aria-pressed", x === b)); drawThreats(); });
  tq.addEventListener("input", drawThreats);
  drawThreats();
  const waitMaps = setInterval(() => { if (MAPS.length) { clearInterval(waitMaps); drawThreats(); } }, 200);
}).catch(e => { document.getElementById("threatcards").textContent = "Couldn't load threat data: " + e.message; });

window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (["news", "guide", "map", "tiers", "threats", "keys"].includes(v)) show(v); });

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
