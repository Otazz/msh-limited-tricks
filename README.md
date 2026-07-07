# MSH Limited Tricks

An Anki-style flashcard trainer for every Instant and Flash-keyword card in the
*Marvel Super Heroes* (`msh`) Magic: The Gathering set — built to help you
remember what could be sitting in an opponent's hand during limited (draft/sealed).

Front of the card shows only the name and mana cost; you recall the effect,
flip it, and rate yourself (Again / Hard / Good / Easy) like Anki. A simplified
SM-2 scheduler tracks per-card intervals in the browser's `localStorage` — no
backend, no account, no sync between devices.

## Running locally

No build step. Just serve the folder over HTTP (needed for `fetch()` to load
`data/cards.json` — opening `index.html` directly via `file://` won't work in
most browsers):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → Source: deploy from branch `main`, folder `/ (root)`.
3. Your trainer will be live at `https://<username>.github.io/<repo>/`.

## Refreshing card data

`data/cards.json` is a snapshot pulled from the [Scryfall API](https://scryfall.com/docs/api).
If Wizards issues errata or Scryfall adds missing prints, regenerate it with:

```bash
python scripts/fetch_cards.py
```

## Your progress

Review history lives only in your browser's `localStorage` (key
`msh-srs-progress`). Use the gear icon → **Export progress** to save a JSON
backup, and **Import progress** to restore it (e.g. after clearing browser
data, or to move to another browser/device manually). **Reset all progress**
wipes it clean.

## Files

- [`index.html`](index.html) — page structure
- [`css/style.css`](css/style.css) — styling
- [`js/srs.js`](js/srs.js) — scheduler (pure functions + localStorage read/write)
- [`js/app.js`](js/app.js) — UI wiring, filters, review loop
- [`data/cards.json`](data/cards.json) — trimmed Scryfall card data
- [`scripts/fetch_cards.py`](scripts/fetch_cards.py) — regenerates `data/cards.json`
