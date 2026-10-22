// Active Matter Field Guide — loads data/*.json and renders the tabs.
const TYPES = {
  wpn:  { n: "Weapons",             c: "--wpn"  },
  med:  { n: "Medical",             c: "--med"  },
  val:  { n: "Valuables",           c: "--val"  },
  key:  { n: "Locked / key",        c: "--key"  },
  boss: { n: "Boss / heavy threat", c: "--boss" }
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
if (["news", "guide", "map", "tiers", "keys"].includes(startView)) show(startView);

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
let MAPS = [], curMap = null, sel = 0;
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

function selectMap(m) {
  curMap = m; sel = 0;
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
    h += `<g class="marker${i === sel ? " sel" : ""}" tabindex="0" role="button" aria-label="${esc(n.label)}" data-i="${i}">` +
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
    `<dl><dt>Loot</dt><dd>${esc(n.loot)}</dd><dt>Access</dt><dd>${esc(n.access)}</dd><dt>Danger</dt><dd>${esc(n.danger)}</dd>${n.tip ? `<dt>Tip</dt><dd>${esc(n.tip)}</dd>` : ""}</dl>`;
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
    `<tr><td>${esc(k.name)}<div class="eyebrow" style="margin-top:2px">${esc(k.map)}</div></td><td>${cell(k.opens)}</td><td>${cell(k.found)}</td><td>${cell(k.craft)}</td><td>${cell(k.loot)}</td><td>${cell(k.uses)}</td>` +
    `<td>${k.source ? `<a href="${esc(k.source)}" target="_blank" rel="noopener">wiki</a>` : ""}</td></tr>`).join("") ||
    `<tr><td colspan="7" class="unk">No keys match.</td></tr>`;
  document.getElementById("keycount").textContent = `${rows.length} of ${KEYS.length} keys`;
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
      `<div class="votes">${Object.entries(w.tiers).map(([s, v]) => `<a class="vote" href="${esc(srcs[s]?.url || "#")}" target="_blank" rel="noopener" title="${esc(srcs[s]?.name || s)}">${esc((srcs[s]?.name || s).replace(/\..*$/, ""))} <b>${esc(v)}</b></a>`).join("") || `<span class="vote">unranked</span>`}</div>` +
      `<p>${esc(w.why)}</p></div>`).join("") + `</div></div>`;
  }).join("");
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
  document.getElementById("lootcols").innerHTML = (data.loot || []).map((b, i) =>
    `<div class="bucket" data-b="${i}"><h3>${esc(b.bucket)}</h3><ul>` + b.items.map(it => `<li><b>${esc(it.name)}</b><span>${esc(it.why)}</span></li>`).join("") + `</ul></div>`).join("");
  document.getElementById("gearcols").innerHTML = (data.gear || []).map(g =>
    `<div class="bucket"><h3>${esc(g.group)}</h3><p class="eyebrow">Best first</p><ul class="gearlist">` + g.rows.map(r => `<li><b>${esc(r.name)}</b><span>${esc(r.note)}</span></li>`).join("") + `</ul></div>`).join("");
}).catch(e => { document.getElementById("tierboard").textContent = "Couldn't load tier data: " + e.message; });
