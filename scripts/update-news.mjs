// Pulls the latest Active Matter news from Steam's public news API and writes data/news.json.
// Run by .github/workflows/update-news.yml on a schedule. Node 20+ (built-in fetch).
import { writeFile, readFile } from "node:fs/promises";

const APP_ID = 2887580;
const API = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID}&count=30&maxlength=0&format=json`;
const OUT = new URL("../data/news.json", import.meta.url);

function clean(text) {
  return text
    .replace(/\{STEAM_CLAN_IMAGE\}[^\s]*/g, "")
    .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, "")
    .replace(/\[\/?[a-z0-9*]+[^\]]*\]/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function summarize(text, max = 320) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return (end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…");
}

let res;
try { res = await fetch(API, { headers: { "User-Agent": "active-matter-field-guide" } }); }
catch (e) { console.error(`Couldn't reach Steam (${e.message}); keeping existing news.json`); process.exit(0); }
if (!res.ok) { console.error(`Steam API returned ${res.status}; keeping existing news.json`); process.exit(0); }
const json = await res.json();
const items = (json?.appnews?.newsitems ?? [])
  .filter(n => n.feed_type === 1 || /steam_community_announcements/.test(n.feedname || ""))
  .map(n => ({
    date: new Date(n.date * 1000).toISOString().slice(0, 10),
    title: n.title.trim(),
    kind: /update|hotfix|patch/i.test(n.title) ? "patch" : "news",
    summary: summarize(clean(n.contents || "")),
    url: n.url
  }));

if (!items.length) { console.error("No items returned; keeping existing news.json"); process.exit(0); }

const next = { updated: new Date().toISOString(), source: "Steam news for app " + APP_ID, items };
let prev = null;
try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch {}
if (prev && JSON.stringify(prev.items) === JSON.stringify(items)) {
  console.log("No new news.");
  process.exit(0);
}
await writeFile(OUT, JSON.stringify(next, null, 2) + "\n");
console.log(`Wrote ${items.length} news items.`);
