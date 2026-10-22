# Active Matter Field Guide

A fan-made guide for **Active Matter**: patch news, raid tips, a loot map and a key reference.
Hosted with GitHub Pages.

## How it updates

| Part | How it stays current |
| --- | --- |
| News | `.github/workflows/update-news.yml` pulls Steam's news feed every 4 hours and commits `data/news.json` when something new is posted. You can also run it by hand from the **Actions** tab. |
| Loot spots | `data/loot.json` — edit by hand or let the weekly research job commit new finds. |
| Keys | `data/keys.json` — same. |
| Tiers & priorities | `data/tiers.json` — same. |
| Monsters & anomalies | `data/threats.json` — same. |

The page reads these JSON files on load, so any commit shows up as soon as Pages redeploys (about a minute).

## Adding real map images

1. Take a screenshot of the in-game raid map (full map view, no UI if possible).
2. Save it to `maps/` — for example `maps/cargo-port.jpg`.
3. In `data/loot.json`, set that map's `"image"` to `"maps/cargo-port.jpg"`.
4. Open the site with `#pick` at the end of the URL (e.g. `https://bilbosagggins.github.io/Active-Matter/#pick`), pick the map, and click where each spot is. The page shows `"x":..,"y":..` (percent of width/height) and copies it.
5. Paste those numbers into the matching node in `data/loot.json`.

Until a map has an image, it shows a schematic board instead. Gigastructure stays schematic because its in-game map is scrambled.

Marker type `exit` draws a green extraction square without a label.

## Data format

`data/loot.json` → `maps[]`:

```json
{ "id": "cargo", "name": "Cargo Port", "image": "maps/cargo-port.jpg", "summary": "…",
  "nodes": [ { "x": 38, "y": 58, "type": "wpn", "label": "Barges", "loot": "…", "access": "…", "danger": "…", "tip": "…" } ],
  "links": [[0, 1]] }
```

`type` is one of `wpn`, `med`, `val`, `key`, `boss`, `exit`. Optional `items` (list of gear names) powers the "Find gear on the map" panel; a key's spot should list the key's exact name from `keys.json`, so its "Find on map" link appears. Weapon spawns are random, so tag weapon spots only as `Weapon crates`. `categories` sets the finder's groups; `common` holds a note for gear that drops everywhere (backpacks, plates, helmets, meds). `links` draws dashed route lines between node indexes.

`data/keys.json` → `keys[]`: `name, map, opens, found, craft, uses, loot, source`. Use `"?"` or `"Unconfirmed"` for unknowns; they render in gray.

## Turning on Pages

Settings → Pages → Source: **Deploy from a branch** → `main` / `(root)`. Also check Settings → Actions → General → Workflow permissions is set to **Read and write** so the news job can commit.
