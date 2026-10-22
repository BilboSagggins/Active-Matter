# Active Matter Field Guide — update instructions

This repo is a static GitHub Pages site for the game **Active Matter** (Gaijin / Matter.Team extraction shooter). The pages read everything from `data/*.json`, so content updates are data edits only. Pages redeploys automatically after every push to `main`.

These instructions are the single source of truth for the scheduled update run. When the site's structure changes, update this file in the same commit.

## Files

- `data/loot.json` — loot spots per map.
  - Each node: `x`/`y` (percent of the map), `type` (`wpn`, `med`, `val`, `key`, `boss`, `exit`), `label`, `loot`, `access`, `danger`, `tip`, optional `items` (gear names that power "Find gear on the map").
  - `categories`: finder groups → item names. Items with "key" or "board" in the name go under Keys & locks automatically.
  - `common`: notes for gear that drops everywhere. A string, or `{ "badge": "...", "note": "..." }` for items that aren't raid drops (e.g. Safe containers → "Shop only").
- `data/keys.json` — keys: `name, map, opens, found, craft, uses, loot, source`. Unknowns are `"?"` or `"Unconfirmed"`.
- `data/tiers.json` — `weapons` (tiers from several community lists in `sources`), `patchNotes`, `mods` (attachment slot priority, picks, builds by role, tips), `loot` (priority buckets), `gear` (plates, helmets, backpacks, rigs, safe containers, other ways to get gear).
- `data/progress.json` — progression: `route` (ordered suggested steps; optional `find` links to a gear-finder item), `spending` tips, `currencies`, `monolith` levels (`level, tokens, needs, unlocks`), `reset` (what a new Personal Timeline keeps/loses), `investigations` (`name, cat, level, tokens`, optional `pick` = why it's worth doing early, optional `after` for chained ones).
- `data/threats.json` — monsters and anomalies: `name, kind, danger (1–4), counters, where (map ids from loot.json), does, beat, drops`, plus `rules`.
- `data/last-run.json` — `{ "date": "YYYY-MM-DD", "model": "...", "changed": true|false }`. Written by every scheduled run so the backup run knows the update already happened.
- `data/news.json` — **don't touch**; the `Update news` GitHub Action refreshes it from Steam.
- Don't change `maps/` images or code (`index.html`, `assets/`, `sw.js`, `manifest.webmanifest`, `icons/`) during a content update. The site is an installable app; its service worker fetches from the network first, so data updates reach phones without any cache changes.

## Scheduled update procedure

0. **Backup check.** If you were started as the *backup* run, read `data/last-run.json`. If its `date` is today (America/Chicago), the main run already finished: stop and reply "Main run already completed today." Otherwise do the full procedure below.
1. Search the web for new or corrected info since the `updated` date in each data file: patch notes at activematter.game/en/news (weapon, attachment, loot, key, map, monster or recipe changes), activematter.wiki.gg pages, and reputable community guides and tier lists.
2. **keys.json**: fill fields marked Unconfirmed/`?` when a source confirms them, add new keys, fix anything a patch changed. Set a `source` URL for each change.
3. **loot.json**: add newly documented spots and edit nodes that patches changed.
   - Every map with an `image` is a real in-game screenshot. Only add a node there if the source places it relative to labeled landmarks; otherwise add the info to an existing node's tip and say the position is approximate.
   - Weapon spawns are random: never tag specific guns. Use `Weapon crates` (or `Military crates (keyed)`).
   - A spot holding a key's lock, or the key itself, lists the key's exact name from keys.json.
   - Every new item name goes into the right group in `categories` (keys excepted). Never put keys, valuables or containers under Weapons & ammo.
   - Improve `common` notes when better info appears on where backpacks, rigs, plates, helmets or meds spawn, and tag confirmed hotspots.
4. **tiers.json**: move weapons after buffs/nerfs if warranted, note the patch in the weapon's `why`, and add it to `patchNotes`. Update `mods` when attachments are added or rebalanced. Update loot priority and gear details when uses, stats or values change.
5. **threats.json**: add new monsters/anomalies, update behavior or counters that patches changed, note drop buffs.
   **progress.json**: fill in Monolith levels beyond Epsilon as they're documented, correct token costs and unlocks, add new investigations, and adjust the route and starred picks when patches change what's worth doing first.
6. Set `updated` to today's date in each file you change. Validate every file parses as JSON.
7. Only add facts backed by a source you read. Paraphrase; don't copy text. If nothing new was found, change nothing.
8. Always write `data/last-run.json` with today's date (America/Chicago), the model you are, and whether any content changed, even if nothing else changed.
9. Commit to `main` with a message summarizing the changes (or "Scheduled check: no new info"), ending with a `Co-Authored-By:` line naming the model you are (e.g. `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`), and push.
10. Reply with a short summary of what changed with source links, or "No new info this run."
