# MSH Limited Tricks

An Anki-style flashcard trainer for every Instant, Flash-keyword, and
instant-speed-activated-ability card in the *Marvel Super Heroes* (`msh`)
Magic: The Gathering set — built to help you remember what could be sitting
in an opponent's hand (or already on their board) during limited (draft/sealed).

Front of the card shows the name and mana cost; you recall the effect, flip
it, and rate yourself (Again / Hard / Good / Easy) like Anki. A simplified
SM-2 scheduler tracks per-card intervals in the browser's `localStorage` — no
backend, no account, no sync between devices.

**Study tab**: the spaced-repetition quiz described above. Filter by color,
card kind (Instant / Flash permanent / Activated ability / Sorcery-speed
removal), or role (combat trick, removal, protection, counter, card
advantage, tempo permanent, utility). Toggle **mana-only mode** in settings
to hide the card name and force yourself to recall a card purely from its
mana cost and type — closer to the real "what could this open mana be"
recall task during a draft. Mana costs render with the real Magic mana
symbols ([mana-font](https://mana.andrewgioia.com/)), not text.

Sorcery-speed removal (Sorceries, Sagas, and creature ETB-trigger removal
with no Flash) is **off by default** — these can't ambush you the way
instant-speed cards can, but are worth recognizing as removal in the format.
Enable it in the Card kind filters if you want to study it too.

**Browse tab**: a plain filterable reference grid (name, image, oracle text,
kind, role) for quick lookup — no quiz mechanics — for when you just want to
look something up.

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

A scheduled GitHub Action ([`.github/workflows/refresh-cards.yml`](.github/workflows/refresh-cards.yml))
re-runs this weekly and opens a PR if the data changed, since `msh` just
released and Scryfall's data may still shift. New cards that show up this way
default to `role: "utility"` until manually re-tagged in `ROLE_TAGS` in
`scripts/fetch_cards.py` — the script prints a warning listing any untagged
cards so you know to go add one.

Card kind is one of `instant`, `flash_permanent`, `activated_ability`, or
`sorcery_removal`. The last two are small hand-picked lists (see
`ACTIVATED_ABILITY_IDS` and `SORCERY_REMOVAL_IDS` in the script) since
neither can be found with a single Scryfall search query — both required
manually scanning oracle text for the relevant timing/effect pattern.

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
