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
if (["news", "guide", "map", "tiers", "planner", "sleeves", "threats", "keys"].includes(startView)) show(startView);

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
    ((r => r ? `<p class="drops"><b>Remains fuse into:</b> ${[...new Set(r.rolls.map(([c]) => base(c)))].map(esc).join(", ")}. Pristine: ${esc(r.pristine)} II/III.</p>` : "")((BUILDS?.chrono?.remains || []).find(r => r.threat === t.name))) +
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

window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (["news", "guide", "map", "tiers", "planner", "sleeves", "threats", "keys"].includes(v)) show(v); });

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

/* ---------- Install app ---------- */
(() => {
  const btn = document.getElementById("installBtn"), help = document.getElementById("installHelp");
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; btn.hidden = false; });
  window.addEventListener("appinstalled", () => { btn.hidden = true; help.hidden = true; });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Show the button everywhere; fall back to written steps when the browser has no install prompt.
  setTimeout(() => { btn.hidden = false; }, 1200);
  btn.addEventListener("click", async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; return; }
    help.hidden = !help.hidden;
    help.innerHTML = ios
      ? "<b>Add to your home screen:</b> tap the Share button, then <b>Add to Home Screen</b>."
      : /SamsungBrowser/i.test(navigator.userAgent)
        ? "<b>Add to your home screen:</b> tap the ☰ menu, then <b>Add page to</b> → <b>Home screen</b>."
        : "<b>Add to your home screen:</b> tap the ⋮ menu, then <b>Install app</b> or <b>Add to Home screen</b>.";
  });
})();

/* ---------- Progression ---------- */
let PROG = null;
const LEVELS = ["Default", "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa", "Lambda", "Chain"];
function drawInvs() {
  const q = document.getElementById("invq").value.trim().toLowerCase(), star = document.getElementById("invstar").checked;
  const list = PROG.investigations.filter(v => (!star || v.pick) && (!q || JSON.stringify(v).toLowerCase().includes(q)));
  document.getElementById("invs").innerHTML = LEVELS.map(L => {
    const g = list.filter(v => v.level === L); if (!g.length) return "";
    const open = q || star || ["Default", "Alpha", "Beta"].includes(L);
    return `<details class="invgroup"${open ? " open" : ""}><summary><span>${L === "Chain" ? "Unlocked by finishing another" : L === "Default" ? "Available from the start" : "Monolith " + L}</span><span class="fcount">${g.length}</span></summary><ul>` +
      g.map(v => `<li class="${v.pick ? "star" : ""}"><div class="invtop"><b>${v.pick ? "★ " : ""}${esc(v.name)}</b><span class="eyebrow">${esc(v.cat)}${v.tokens ? " · " + esc(v.tokens) + " tokens" : ""}</span></div>` +
        `${v.pick ? `<span class="invwhy">${esc(v.pick)}</span>` : ""}${v.after ? `<span class="invwhy">After: ${esc(v.after)}</span>` : ""}</li>`).join("") + `</ul></details>`;
  }).join("") || `<p class="unk">No investigations match.</p>`;
}
getJSON("data/progress.json").then(d => {
  PROG = d;
  document.getElementById("route").innerHTML = d.route.map(r => `<li><h3>${esc(r.step)}</h3><p>${esc(r.detail)}</p>${r.find ? `<button class="findlink" data-find="${esc(r.find)}" hidden>Find on map →</button>` : ""}</li>`).join("");
  document.getElementById("mono").innerHTML = d.monolith.map(m => `<tr><td>${esc(m.level)}</td><td class="num">${esc(m.tokens)}</td><td>${esc(m.needs)}</td><td>${esc(m.unlocks)}</td></tr>`).join("");
  document.getElementById("spend").innerHTML = d.spending.map(x => `<li>${esc(x)}</li>`).join("");
  document.getElementById("curr").innerHTML = d.currencies.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.use)}</td><td>${esc(c.source)}</td></tr>`).join("");
  document.getElementById("reset").innerHTML = `<li><b>Kept:</b> ${esc(d.reset.kept)}</li><li><b>Lost:</b> ${esc(d.reset.lost)}</li>`;
  document.getElementById("invq").addEventListener("input", drawInvs);
  document.getElementById("invstar").addEventListener("change", drawInvs);
  drawInvs(); refreshFindLinks();
}).catch(e => { document.getElementById("route").textContent = "Couldn't load progression data: " + e.message; });

/* ---------- Builds ---------- */
let BUILDS = null, chTag = "";
const base = s => s.replace(/ (I|II|III)$/, "");
function sourcesFor(name) {
  const R = BUILDS?.chrono?.remains || [];
  const rows = [];
  R.forEach(r => {
    const t1 = r.rolls.find(([c]) => c === name + " I"), t2 = r.rolls.find(([c]) => c === name + " II");
    if (t1 || t2) rows.push({ src: r.source, threat: r.threat, item: r.item, t1: t1 ? t1[1] : 0, t2: t2 ? t2[1] : 0, pristine: r.pristine === name });
    else if (r.pristine === name) rows.push({ src: r.source, threat: r.threat, item: r.item, t1: 0, t2: 0, pristine: true });
  });
  return rows.sort((a, b) => (b.t1 + b.t2) - (a.t1 + a.t2));
}
function sourceBlock(name) {
  const rows = sourcesFor(name);
  if (!rows.length) return `<div class="srcbox"><span class="eyebrow">Dropped by</span><p class="unk">${esc(BUILDS.chrono.noRemains || "Not tied to a monster.")}</p></div>`;
  return `<div class="srcbox"><span class="eyebrow">Dropped by (fuse their remains)</span><ul>` + rows.map(r =>
    `<li><button class="srcname"${r.threat ? ` data-threat="${esc(r.threat)}"` : " disabled"}>${esc(r.src)}</button>` +
    `<span class="srcodds">${r.t1 ? `I ${r.t1}%` : ""}${r.t2 ? ` · II ${r.t2}%` : ""}${r.pristine ? `${r.t1 || r.t2 ? " · " : ""}<b>pristine: II 90% / III 10%</b>` : ""}</span></li>`).join("") + `</ul></div>`;
}
function drawRemains() {
  const q = document.getElementById("remq").value.trim().toLowerCase();
  const list = BUILDS.chrono.remains.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
  document.getElementById("remains").innerHTML = list.map(r =>
    `<div class="remcard"><div class="ttop"><h3>${esc(r.source)}</h3><span class="kind">${esc(r.item)}</span></div>` +
    `<ul class="rolls">${r.rolls.map(([c, p]) => `<li${q && c.toLowerCase().includes(q) ? ' class="hit"' : ""}><span>${esc(c)}</span><span class="pct"><i style="width:${Math.min(100, p * 1.6)}%"></i>${p}%</span></li>`).join("")}</ul>` +
    `<p class="pris"><b>Pristine:</b> ${esc(r.pristine)} II (90%) or III (10%)</p>` +
    (r.note ? `<p class="invwhy">${esc(r.note)}</p>` : "") +
    (r.threat ? `<button class="findlink" data-threat="${esc(r.threat)}">How to kill it →</button>` : "") + `</div>`).join("") || `<p class="unk">Nothing matches.</p>`;
}
function drawChrono() {
  const q = document.getElementById("chq").value.trim().toLowerCase();
  const ok = c => (!chTag || c.tag === chTag) && (!q || JSON.stringify(c).toLowerCase().includes(q));
  const used = new Set(BUILDS.builds.flatMap(b => b.slots));
  const ab = BUILDS.chrono.abilities.filter(ok), tr = BUILDS.chrono.tiered.filter(ok);
  document.getElementById("abcount").textContent = ab.length;
  document.getElementById("stcount").textContent = tr.length;
  document.getElementById("abilities").innerHTML = (ab.length ? `<li class="absrc">${esc(BUILDS.chrono.abilitySource || "")}</li>` : "") + ab.map(c => `<li class="${used.has(c.name) ? "star" : ""}"><div class="invtop"><b>${esc(c.name)}</b><span class="eyebrow">${esc(c.tag)}</span></div><span class="invwhy">${esc(c.what)}</span></li>`).join("") || `<li class="unk">None match.</li>`;
  document.getElementById("tiered").innerHTML = tr.map(c => `<li class="${used.has(c.name) ? "star" : ""}"><div class="invtop"><b>${esc(c.name)}</b><span class="eyebrow">${esc(c.tag)}</span></div><span class="invwhy">${esc(c.detail || c.what)}</span><div class="tiers3">${c.t.map((v, i) => `<span><i>${["I", "II", "III"][i]}</i>${esc(v)}</span>`).join("")}</div>${sourceBlock(c.name)}</li>`).join("") || `<li class="unk">None match.</li>`;
}
getJSON("data/builds.json").then(d => {
  BUILDS = d;
  document.getElementById("builds").innerHTML = d.builds.map(b => `<details class="tcard build"><summary><div class="ttop"><h3>${esc(b.name)}</h3></div><div class="bslots">${b.slots.map(x => `<span>${esc(x)}</span>`).join("")}</div></summary>` +
    `<div class="tbody"><p class="does">${esc(b.why)}</p><dl class="bdl"><dt>Swap in</dt><dd>${esc(b.swap)}</dd><dt>Body sleeve</dt><dd>${esc(b.sleeve)}</dd></dl></div></details>`).join("");
  document.getElementById("btips").innerHTML = d.tips.map(x => `<li>${esc(x)}</li>`).join("");
  document.getElementById("remhow").innerHTML = (d.chrono.remainsHow || []).map(x => `<li>${esc(x)}</li>`).join("");
  document.getElementById("remq").addEventListener("input", drawRemains);
  drawRemains();
  document.getElementById("chhow").innerHTML = d.chrono.how.map(x => `<li>${esc(x)}</li>`).join("");
  document.getElementById("skhow").innerHTML = d.skills.how.map(x => `<li>${esc(x)}</li>`).join("");
  document.getElementById("skpri").innerHTML = d.skills.priorities.map(p => `<tr><td>${esc(p.goal)}</td><td>${esc(p.pick)}</td></tr>`).join("");
  document.getElementById("skagency").textContent = d.skills.agency;
  const tags = [...new Set([...d.chrono.tiered, ...d.chrono.abilities].map(c => c.tag))].sort();
  const box = document.getElementById("chtags");
  box.innerHTML = `<button class="chip" aria-pressed="true" data-t="">All</button>` + tags.map(t => `<button class="chip" aria-pressed="false" data-t="${esc(t)}">${esc(t)}</button>`).join("");
  box.addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; chTag = chTag === b.dataset.t ? "" : b.dataset.t; box.querySelectorAll("[data-t]").forEach(x => x.setAttribute("aria-pressed", x.dataset.t === chTag)); drawChrono(); });
  document.getElementById("chq").addEventListener("input", drawChrono);
  drawChrono();
}).catch(e => { document.getElementById("builds").textContent = "Couldn't load build data: " + e.message; });

/* threat links from remains + remains line on threat cards */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-threat]"); if (!t) return;
  show("threats"); history.replaceState(null, "", "#threats");
  tq.value = t.dataset.threat; tCounter = "";
  document.querySelectorAll("#countchips [data-c]").forEach(x => x.setAttribute("aria-pressed", x.dataset.c === ""));
  openThreats.add(t.dataset.threat); drawThreats();
  document.getElementById("threatcards").scrollIntoView({ block: "start" });
});

/* ---------- Sleeves ---------- */
let SLEEVES = null, sRole = "", sKind = "";
const openSleeves = new Set();
function drawSleeves() {
  const q = document.getElementById("sleeveq").value.trim().toLowerCase();
  const list = SLEEVES.sleeves.filter(x => (!sRole || x.role === sRole) && (!sKind || x.kind === sKind) && (!q || JSON.stringify(x).toLowerCase().includes(q)));
  document.getElementById("sleevecount").textContent = `${list.length} of ${SLEEVES.sleeves.length}`;
  document.getElementById("sleevecards").innerHTML = list.map(x =>
    `<details class="tcard sleeve" data-r="${esc(x.rarity)}" data-name="${esc(x.name)}"${openSleeves.has(x.name) ? " open" : ""}>` +
    `<summary><div class="ttop"><h3>${esc(x.name)}</h3><span class="kind">${esc(x.rarity)} · ${esc(x.role)}</span></div>` +
    `<div class="tsum"><span class="cchip">${esc(x.plates)}</span><span class="cchip">${x.vol} vol</span><span class="ukind ${x.status}">${esc(x.kind)}</span></div></summary>` +
    `<div class="tbody"><div class="eyebrow">Perks</div><ul>${x.mods.map(m => `<li>${esc(m)}</li>`).join("")}</ul>` +
    `<dl class="bdl"><dt>Unlock</dt><dd${x.status === "unconfirmed" ? ' class="unk"' : ""}>${esc(x.how)}</dd>${x.detail ? `<dt>Details</dt><dd>${esc(x.detail)}</dd>` : ""}${x.char ? `<dt>Operative</dt><dd>${esc(x.char)}</dd>` : ""}</dl>` +
    `${x.source ? `<a class="findlink" href="${esc(x.source)}" target="_blank" rel="noopener">Wiki page →</a>` : ""}</div></details>`).join("") || `<p class="unk">No sleeves match.</p>`;
  document.querySelectorAll("#sleevecards details").forEach(d => d.addEventListener("toggle", () => { d.open ? openSleeves.add(d.dataset.name) : openSleeves.delete(d.dataset.name); syncS(); }));
  syncS();
}
function syncS() { const ds = [...document.querySelectorAll("#sleevecards details")]; document.getElementById("sexpand").textContent = ds.length && ds.every(d => d.open) ? "Collapse all" : "Expand all"; }
document.getElementById("sexpand").addEventListener("click", () => {
  const ds = [...document.querySelectorAll("#sleevecards details")], open = !ds.every(d => d.open);
  ds.forEach(d => { d.open = open; open ? openSleeves.add(d.dataset.name) : openSleeves.delete(d.dataset.name); }); syncS();
});
function chipRow(id, values, get, set) {
  const box = document.getElementById(id);
  box.innerHTML = `<span class="flabel">${id === "srole" ? "Role" : "Unlocked by"}</span><button class="chip" aria-pressed="true" data-v="">All</button>` + values.map(v => `<button class="chip" aria-pressed="false" data-v="${esc(v)}">${esc(v)}</button>`).join("");
  box.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (!b) return; const v = get() === b.dataset.v ? "" : b.dataset.v; set(v);
    box.querySelectorAll("[data-v]").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === v)); drawSleeves(); });
}
getJSON("data/sleeves.json").then(d => {
  SLEEVES = d;
  document.getElementById("sleeveStamp").textContent = d.updated || "";
  document.getElementById("sbest").innerHTML = d.best.map(b => `<tr><td>${esc(b.goal)}</td><td>${esc(b.pick)}</td></tr>`).join("");
  document.getElementById("show").innerHTML = d.how.map(x => `<li>${esc(x)}</li>`).join("");
  document.getElementById("snote").textContent = d.note || "";
  chipRow("srole", [...new Set(d.sleeves.map(x => x.role))], () => sRole, v => sRole = v);
  chipRow("skind", ["Edition", "Monolith", "Starter chain", "Investigation", "Event", "Unknown"].filter(k => d.sleeves.some(x => x.kind === k)), () => sKind, v => sKind = v);
  document.getElementById("sleeveq").addEventListener("input", drawSleeves);
  drawSleeves();
}).catch(e => { document.getElementById("sleevecards").textContent = "Couldn't load sleeve data: " + e.message; });

/* ---------- Build planner ---------- */
(() => {
  const VIEWS = ["news", "guide", "map", "tiers", "planner", "sleeves", "threats", "keys"];
  const h = location.hash.slice(1); if (h === "planner") show("planner");
  window.addEventListener("hashchange", () => { if (location.hash === "#planner") show("planner"); });
  const KEY = "am-planner-v1";
  let P = null, B = null, SL = null, state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { state = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const lvl = l => P.order.indexOf(l);
  const INV = () => P.investigations;
  const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(label)}</option>`;
  const ATT = ["Muzzle", "Optic", "Stock", "Grip", "Light / laser"];
  const GEAR = ["Helmet", "Armor plate", "Rig", "Backpack", "Safe container"];

  function itemReq(it) {
    if (!it) return null;
    if (it.kind === "Investigation") { const v = INV()[it.inv]; return { kind: "inv", inv: it.inv, level: v ? v.level : "", text: `${it.inv} investigation${v ? ` (${v.level}${v.tokens ? ", " + v.tokens.toLocaleString() + " tokens" : ""})` : ""}` }; }
    if (it.kind === "Monolith") return { kind: "mono", level: it.level, text: it.note || `Monolith ${it.level}` };
    return { kind: "shop", text: it.note || "Shop or raid loot." };
  }
  function sleeveReq(x) {
    if (!x) return null;
    const m = (x.how || "").match(/^(.*) investigation$/);
    if (m && INV()[m[1]]) { const v = INV()[m[1]]; return { kind: "inv", inv: m[1], level: v.level, text: x.how + (x.detail ? ". " + x.detail : "") }; }
    if (x.kind === "Monolith") return { kind: "mono", level: x.how.replace("Monolith ", ""), text: x.how + (x.detail ? ". " + x.detail : "") };
    return { kind: x.kind === "Edition" ? "edition" : "shop", text: x.how + (x.detail ? ". " + x.detail : "") };
  }
  const chronoAll = () => [...B.chrono.abilities.map(c => ({ ...c, ability: true })), ...B.chrono.tiered];
  function chronoReq(name, tier) {
    const c = chronoAll().find(x => x.name === name); if (!c) return null;
    const out = { mobs: [], notes: [], level: "" };
    if (c.ability) { out.notes.push("Ability chronogenes come from Tier III random synthesis (Monolith Epsilon) or the Rare Distorted recipe from Distorted Chronogene Study."); out.level = "Epsilon"; out.inv = "Distorted Chronogene Study"; return out; }
    const src = sourcesFor(name);
    if (!src.length) out.notes.push("No monster drops it. Use random Tier II/III synthesis.");
    src.forEach(r => {
      if (tier === "III") { if (r.pristine) out.mobs.push([r.threat || r.src, `pristine remains → ${name} III (10%)`]); }
      else if ((tier === "I" && r.t1) || (tier === "II" && (r.t2 || r.pristine))) out.mobs.push([r.threat || r.src, `${r.item} → ${name} ${tier} (${tier === "I" ? r.t1 + "%" : [r.t2 ? r.t2 + "% normal" : "", r.pristine ? "90% pristine" : ""].filter(Boolean).join(", ")})`]);
    });
    if (tier === "III") { out.notes.push(`Tier III: ${src.some(r => r.pristine) ? "rare roll from pristine remains, or " : ""}Tier III synthesis (20 Active Matter + 3 Tier II, Monolith Epsilon).`); out.level = src.some(r => r.pristine) ? "" : "Epsilon"; }
    return out;
  }

  function slotHTML(slot) {
    const v = state[slot] || "";
    if (slot === "sleeve") {
      const x = SL.sleeves.find(s => s.name === v);
      return `<label>Sleeve<select data-k="sleeve">${opt("", "— none —")}${["Armour", "XL torso", "Speed", "Stealth", "Healing", "Melee"].map(r => `<optgroup label="${r}">${SL.sleeves.filter(s => s.role === r).map(s => opt(s.name, `${s.name} (${s.rarity})`, s.name === v)).join("")}</optgroup>`).join("")}</select></label>` +
        (x ? `<div class="pinfo"><div class="tsum"><span class="cchip">${esc(x.plates)}</span><span class="cchip">${x.vol} vol</span></div><ul>${x.mods.map(m => `<li>${esc(m)}</li>`).join("")}</ul><p class="preq ${sleeveReq(x).kind}"><b>Get it:</b> ${esc(sleeveReq(x).text)}</p></div>` : "");
    }
    if (slot.startsWith("chrono")) {
      const t = state[slot + "t"] || "I";
      const c = chronoAll().find(x => x.name === v);
      const taken = [0, 1, 2, 3].map(i => state["chrono" + i]).filter((n, i) => n && "chrono" + i !== slot);
      const sel = `<select data-k="${slot}">${opt("", "— empty slot —")}<optgroup label="Abilities">${B.chrono.abilities.filter(c => !taken.includes(c.name)).map(c => opt(c.name, c.name, c.name === v)).join("")}</optgroup><optgroup label="Stat (Tier I–III)">${B.chrono.tiered.filter(c => !taken.includes(c.name)).map(c => opt(c.name, c.name, c.name === v)).join("")}</optgroup></select>`;
      const tierSel = c && !c.ability ? `<select data-k="${slot}t" class="tiersel" aria-label="Tier">${["I", "II", "III"].map(x => opt(x, "Tier " + x, x === t)).join("")}</select>` : "";
      let info = "";
      if (c) {
        const r = chronoReq(c.name, t);
        const val = c.ability ? "" : `<span class="cchip">Tier ${t}: ${esc(c.t[["I", "II", "III"].indexOf(t)])}</span>`;
        info = `<div class="pinfo"><p class="pdesc">${esc(c.detail || c.what)}</p><div class="tsum"><span class="eyebrow">${esc(c.tag)}</span>${val}</div>` +
          (r.mobs.length ? `<p class="preq"><b>Farm:</b> ${r.mobs.map(([m, why]) => `<button class="srcname" data-threat="${esc(m)}">${esc(m)}</button> <span class="srcodds">${esc(why)}</span>`).join("<br>")}</p>` : "") +
          r.notes.map(n => `<p class="preq">${esc(n)}</p>`).join("") + `</div>`;
      }
      return `<label>Slot ${+slot.slice(-1) + 1}<span class="selrow">${sel}${tierSel}</span></label>${info}`;
    }
    if (slot === "w1" || slot === "w2") {
      const ws = P.items.filter(i => i.type === "weapon");
      const classes = [...new Set(ws.map(w => w.sub))].sort();
      const it = ws.find(w => w.name === v), tr = (TIERS?.weapons || []).find(w => w.name === v);
      return `<label>${slot === "w1" ? "Primary" : "Secondary"}<select data-k="${slot}">${opt("", "— none —")}${classes.map(c => `<optgroup label="${esc(c)}">${ws.filter(w => w.sub === c).map(w => opt(w.name, w.name, w.name === v)).join("")}</optgroup>`).join("")}</select></label>` +
        (it ? `<div class="pinfo">${tr ? `<p class="pdesc">${esc(tr.why)}</p>` : ""}<p class="preq ${itemReq(it).kind}"><b>Get it:</b> ${esc(itemReq(it).text)}</p></div>` : "");
    }
    const [w, att] = slot.includes("-") ? slot.split(/-(.+)/) : [null, null];
    if (att) {
      const list = P.items.filter(i => i.type === "attachment" && i.sub === att), it = list.find(i => i.name === v);
      return `<label>${esc(att)}<select data-k="${slot}">${opt("", "— none —")}${list.map(i => opt(i.name, i.name + (i.kind === "Investigation" ? " ★" : ""), i.name === v)).join("")}</select></label>` +
        (it ? `<p class="preq small ${itemReq(it).kind}">${esc(itemReq(it).text)}</p>` : "");
    }
    const list = P.items.filter(i => i.type === "gear" && i.sub === slot), it = list.find(i => i.name === v);
    return `<label>${esc(slot)}<select data-k="${slot}">${opt("", "— none —")}${list.map(i => opt(i.name, i.name, i.name === v)).join("")}</select></label>` +
      (it ? `<p class="preq small ${itemReq(it).kind}">${esc(itemReq(it).text)}</p>` : "");
  }

  function renderSlots() { document.querySelectorAll("#planner .slot").forEach(el => el.innerHTML = slotHTML(el.dataset.slot)); }

  function renderPlan() {
    const reqs = []; // {why, req}
    const add = (why, req) => req && reqs.push({ why, req });
    const sx = SL.sleeves.find(s => s.name === state.sleeve); if (sx) add(sx.name + " sleeve", sleeveReq(sx));
    const mobs = {}; // name -> [reasons]
    const addMob = (m, why) => (mobs[m] ||= new Set()).add(why);
    const notes = new Set(); let minLvl = "Alpha";
    const bump = l => { if (l && lvl(l) > lvl(minLvl) && lvl(l) <= lvl("Mu")) minLvl = l; };
    [0, 1, 2, 3].forEach(i => {
      const n = state["chrono" + i]; if (!n) return;
      const t = state["chrono" + i + "t"] || "I", r = chronoReq(n, t);
      r.mobs.forEach(([m, why]) => addMob(m, why)); r.notes.forEach(x => notes.add(x)); bump(r.level);
      if (r.inv) add(n + " (ability)", { kind: "inv", inv: r.inv, level: INV()[r.inv].level, optional: true });
    });
    ["w1", "w2", ...["w1", "w2"].flatMap(w => ATT.map(a => w + "-" + a)), ...GEAR].forEach(k => {
      const it = P.items.find(i => i.name === state[k] && (k.includes("-") ? i.type === "attachment" : k.startsWith("w") ? i.type === "weapon" : i.type === "gear"));
      if (it) add(it.name, itemReq(it));
    });
    const invs = {}, buys = [], editions = [];
    reqs.forEach(({ why, req }) => {
      if (req.kind === "inv") { (invs[req.inv] ||= { why: new Set(), optional: true }).why.add(why); if (!req.optional) invs[req.inv].optional = false; bump(req.level); }
      else if (req.kind === "mono") { bump(req.level); buys.push([why, req.text]); }
      else if (req.kind === "edition") editions.push([why, req.text]);
      else buys.push([why, req.text]);
    });
    const maps = new Set();
    Object.entries(invs).forEach(([name, o]) => { const v = INV()[name]; if (!v) return; if (!o.optional) v.mobs.forEach(([m, c, w]) => addMob(m, `${c ? c + " kills " : ""}${w} (${name})`)); v.maps.forEach(m => maps.add(m)); });
    const invList = Object.entries(invs).sort((a, b) => lvl(INV()[a[0]]?.level) - lvl(INV()[b[0]]?.level));
    const tokens = invList.filter(([, o]) => !o.optional).reduce((s, [n]) => s + (INV()[n]?.tokens || 0), 0);
    const empty = !reqs.length && !Object.keys(mobs).length;
    document.getElementById("plan").innerHTML = empty ? `<h3>Your plan</h3><p class="unk">Pick a sleeve, chronogenes, weapons or gear and your to-do list shows up here.</p>` :
      `<h3>Your plan</h3>
      <div class="pstats"><div><span class="eyebrow">Monolith level</span><b>${esc(minLvl)}</b></div><div><span class="eyebrow">Investigations</span><b>${invList.filter(([, o]) => !o.optional).length}</b></div><div><span class="eyebrow">Tokens to start them</span><b>${tokens.toLocaleString()}</b></div></div>` +
      (invList.length ? `<h4>Investigations to complete</h4><ol class="pinv">${invList.map(([n, o]) => { const v = INV()[n] || {};
        return `<li${o.optional ? ' class="opt"' : ""}><details><summary><b>${esc(n)}</b> <span class="eyebrow">${esc(v.level || "")}${v.tokens ? " · " + v.tokens.toLocaleString() + " tokens" : ""}${o.optional ? " · optional" : ""}</span><span class="pfor">For: ${[...o.why].map(esc).join(", ")}</span></summary>` +
          (v.steps?.length ? `<ol class="psteps">${v.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : `<p class="unk">Stages not documented yet.</p>`) +
          (v.gives ? `<p class="pdesc"><b>Also gives:</b> ${esc(v.gives)}</p>` : "") + (v.url ? `<a class="findlink" href="${esc(v.url)}" target="_blank" rel="noopener">Wiki page →</a>` : "") + `</details></li>`; }).join("")}</ol>` : "") +
      (Object.keys(mobs).length ? `<h4>Monsters to hunt</h4><ul class="pmobs">${Object.entries(mobs).map(([m, w]) => `<li><button class="srcname" data-threat="${esc(m)}">${esc(m)}</button><span>${[...w].map(esc).join("; ")}</span></li>`).join("")}</ul>` : "") +
      (maps.size ? `<h4>Maps you'll visit</h4><div class="tsum">${[...maps].map(m => { const mm = MAPS.find(x => x.name === m); return mm ? `<button class="cchip mapbtn" data-gomap="${mm.id}">${esc(m)}</button>` : `<span class="cchip">${esc(m)}</span>`; }).join("")}</div>` : "") +
      (buys.length ? `<h4>Buy, loot or unlock</h4><ul class="pbuy">${buys.map(([w, t]) => `<li><b>${esc(w)}:</b> ${esc(t)}</li>`).join("")}</ul>` : "") +
      (editions.length ? `<h4>Needs an edition</h4><ul class="pbuy">${editions.map(([w, t]) => `<li><b>${esc(w)}:</b> ${esc(t)}</li>`).join("")}</ul>` : "") +
      (notes.size ? `<h4>Notes</h4><ul class="pbuy">${[...notes].map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : "");
  }
  const renderAll = () => { renderSlots(); renderPlan(); };

  document.getElementById("planner").addEventListener("change", e => {
    const k = e.target.dataset.k; if (!k) return;
    state[k] = e.target.value; if (!e.target.value) delete state[k];
    if (k === "w1" || k === "w2") {} // keep attachments
    save(); renderAll();
  });
  document.getElementById("pl-reset").addEventListener("click", () => { state = {}; save(); document.getElementById("pl-preset").value = ""; renderAll(); });
  document.getElementById("pl-preset").addEventListener("change", e => {
    const b = B.builds.find(x => x.name === e.target.value); if (!b) return;
    b.slots.forEach((n, i) => { state["chrono" + i] = n; delete state["chrono" + i + "t"]; });
    const sn = (b.sleeve.match(/\b(Knight|Beast|Rock|Viper|Ghost|Shadow|Paladin|Reaper|Warlord|Mirage|Bulwark|Angel|Pulse)\b/) || [])[1];
    if (sn) state.sleeve = sn;
    save(); renderAll();
  });

  Promise.all([getJSON("data/planner.json"), getJSON("data/builds.json"), getJSON("data/sleeves.json"), getJSON("data/tiers.json")]).then(([p, b, sl, t]) => {
    P = p; B = b; SL = sl; if (!BUILDS) BUILDS = b; if (!TIERS) TIERS = t;
    document.getElementById("pl-preset").innerHTML = opt("", "A suggested build…") + b.builds.map(x => opt(x.name, x.name)).join("");
    document.getElementById("pl-notes").innerHTML = p.notes.map(n => `<li>${esc(n)}</li>`).join("");
    renderAll();
    const w = setInterval(() => { if (MAPS.length) { clearInterval(w); renderPlan(); } }, 300);
  }).catch(e => { document.getElementById("plan").textContent = "Couldn't load planner data: " + e.message; });
})();
