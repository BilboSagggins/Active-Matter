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
- `data/threats.json` — monsters and anomalies: `name, kind, danger (1–4), counters, where (map ids from loot.json), does, beat, drops`, plus `rules`.
- `data/news.json` — **don't touch**; the `Update news` GitHub Action refreshes it from Steam.
- Don't change `maps/` images or code (`index.html`, `assets/`) during a content update.

## Scheduled update procedure

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
6. Set `updated` to today's date in each file you change. Validate every file parses as JSON.
7. Only add facts backed by a source you read. Paraphrase; don't copy text. If nothing new was found, change nothing.
8. Commit to `main` with a message summarizing the changes, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, and push.
9. Reply with a short summary of what changed with source links, or "No new info this run."
