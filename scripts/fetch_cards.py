"""Fetch instant/flash/activated-ability board-interaction cards from the
Marvel Super Heroes (msh) set via Scryfall and write a trimmed dataset to
data/cards.json for the web app to consume.

Re-run this if Scryfall's data changes (errata, new printings, etc).

Three "kind" buckets are produced:
  - instant: cast from hand at instant speed, one-shot effect
  - flash_permanent: a permanent (creature/artifact/enchantment) with Flash,
    cast from hand at instant speed
  - activated_ability: already-on-the-battlefield permanents with an
    activated ability that has no "activate only as a sorcery/during combat"
    restriction, meaning it can ambush you on any player's turn even though
    the card itself isn't an Instant or Flash permanent

Each card also gets a hand-curated `role` tag (see ROLE_TAGS below) describing
its primary function in a limited game: combat_trick, removal, protection,
counter, card_advantage, tempo_permanent, or utility. This is a simplification
-- some cards do more than one thing -- but it's meant to match how you'd
reason about a card while actually playing, not an exhaustive rules summary.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

QUERY = "e:msh (t:instant or keyword:flash)"
SEARCH_URL = f"https://api.scryfall.com/cards/search?q={urllib.parse.quote(QUERY)}&unique=cards&order=cmc"

# Cards with an unrestricted instant-speed activated ability, found by manually
# scanning e:msh oracle text for activated abilities with no sorcery-speed
# restriction. Not discoverable via a single Scryfall search query.
ACTIVATED_ABILITY_IDS = [
    "f9b9f9d6-b50c-4b29-80be-284ba773c70b",  # Raft Security Officer
    "fd1f0b5f-5e0e-4da1-ab54-a62db5af3591",  # Bullseye, Death Dealer
    "2c6ab9bb-dba2-4b5b-a4d9-54735f65ac21",  # Abomination, Terrifying Titan
    "11fc8221-756a-4919-9272-38793e9c1ad9",  # Super-Skrull
]

ROLE_TAGS = {
    "Giant Growth": "combat_trick",
    "Helicarrier Strike": "removal",
    "Panther Pounce": "combat_trick",
    "Rapid Rescue": "card_advantage",
    "Super Speed": "combat_trick",
    "Blazing Crescendo": "combat_trick",
    "Dark Deed": "removal",
    "Decoy Ploy": "card_advantage",
    "HULK SMASH!": "removal",
    "Lightning Strike": "removal",
    "Night Nurse, Healer of Heroes": "tempo_permanent",
    "Stolen Stark Tech": "protection",
    "Super Suit": "combat_trick",
    "Super Villain Lockup": "removal",
    "Take Up the Shield": "protection",
    "Team Tactics": "combat_trick",
    "The Wondrous Wasp": "tempo_permanent",
    "Tigra, Feline Fury": "tempo_permanent",
    "Vision of Love": "card_advantage",
    "We Say Thee Nay!": "counter",
    "Widow's Bite": "removal",
    "Depower": "combat_trick",
    "Ghost, Spectral Saboteur": "tempo_permanent",
    "Hire a Crew": "combat_trick",
    "I Am Iron Man": "combat_trick",
    "King T'Challa // Black Panther, Hope Enduring": "tempo_permanent",
    "Punishing Punch": "removal",
    "Red Guardian, Super-Soldier": "removal",
    "S.H.I.E.L.D. Flying Car": "protection",
    "Spider-Man, To the Rescue": "protection",
    "Thirst for Knowledge": "card_advantage",
    "Visions of Villainy": "card_advantage",
    "Giant-Sized Flying Ant": "utility",
    "Hour of Defeat": "removal",
    "Spider-Woman, Secret Agent": "tempo_permanent",
    "Thunderbolts Conspiracy": "tempo_permanent",
    "Truck Toss": "removal",
    "Avengers Assemble!": "tempo_permanent",
    "Captain Marvel, Earth's Protector": "tempo_permanent",
    "Raft Security Officer": "utility",
    "Bullseye, Death Dealer": "removal",
    "Abomination, Terrifying Titan": "removal",
    "Super-Skrull": "removal",
}

OUT_PATH = Path(__file__).parent.parent / "data" / "cards.json"


def _get(url):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "msh-limited-tricks/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def fetch_search(url):
    cards = []
    while url:
        payload = _get(url)
        cards.extend(payload["data"])
        url = payload.get("next_page") if payload.get("has_more") else None
    return cards


def face_image(face):
    return face.get("image_uris", {}).get("normal")


def trim(card, kind):
    name = card["name"]
    faces = card.get("card_faces")
    if faces:
        front, back = faces[0], faces[1]
        base = {
            "mana_cost": front.get("mana_cost", ""),
            "type_line": front["type_line"],
            "oracle_text": front.get("oracle_text", ""),
            "colors": front.get("colors", []),
            "images": [
                {"label": front["name"], "url": face_image(front)},
                {"label": back["name"], "url": face_image(back)},
            ],
            "back_face": {
                "name": back["name"],
                "type_line": back["type_line"],
                "oracle_text": back.get("oracle_text", ""),
                "mana_cost": back.get("mana_cost", ""),
            },
        }
    else:
        base = {
            "mana_cost": card.get("mana_cost", ""),
            "type_line": card["type_line"],
            "oracle_text": card.get("oracle_text", ""),
            "colors": card.get("colors", []),
            "images": [{"label": name, "url": card.get("image_uris", {}).get("normal")}],
            "back_face": None,
        }
    return {
        "id": card["id"],
        "name": name,
        "cmc": card["cmc"],
        "rarity": card["rarity"],
        "keywords": card.get("keywords", []),
        "scryfall_uri": card["scryfall_uri"],
        "kind": kind,
        "role": ROLE_TAGS.get(name, "utility"),
        **base,
    }


def main():
    search_results = fetch_search(SEARCH_URL)
    trimmed = []
    for card in search_results:
        faces = card.get("card_faces")
        type_line = faces[0]["type_line"] if faces else card["type_line"]
        kind = "instant" if "Instant" in type_line else "flash_permanent"
        trimmed.append(trim(card, kind))

    for card_id in ACTIVATED_ABILITY_IDS:
        card = _get(f"https://api.scryfall.com/cards/{card_id}")
        trimmed.append(trim(card, "activated_ability"))

    missing_roles = [c["name"] for c in trimmed if c["name"] not in ROLE_TAGS]
    if missing_roles:
        print(f"Warning: no role tag for {len(missing_roles)} card(s), defaulted to 'utility': {missing_roles}")

    trimmed.sort(key=lambda c: (c["cmc"], c["name"]))
    OUT_PATH.write_text(json.dumps(trimmed, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(trimmed)} cards to {OUT_PATH}")


if __name__ == "__main__":
    main()
