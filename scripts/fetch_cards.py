"""Fetch instant/flash cards from the Marvel Super Heroes (msh) set via Scryfall
and write a trimmed dataset to data/cards.json for the web app to consume.

Re-run this if Scryfall's data changes (errata, new printings, etc).
"""
import json
import urllib.request
from pathlib import Path

QUERY = "e:msh (t:instant or keyword:flash)"
URL = f"https://api.scryfall.com/cards/search?q={urllib.parse.quote(QUERY)}&unique=cards&order=cmc"

import urllib.parse

OUT_PATH = Path(__file__).parent.parent / "data" / "cards.json"


def fetch_all(url):
    cards = []
    while url:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "msh-limited-tricks/1.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req) as resp:
            payload = json.load(resp)
        cards.extend(payload["data"])
        url = payload.get("next_page") if payload.get("has_more") else None
    return cards


def face_image(face):
    return face.get("image_uris", {}).get("normal")


def trim(card):
    faces = card.get("card_faces")
    if faces:
        front, back = faces[0], faces[1]
        return {
            "id": card["id"],
            "name": card["name"],
            "mana_cost": front.get("mana_cost", ""),
            "cmc": card["cmc"],
            "type_line": front["type_line"],
            "oracle_text": front.get("oracle_text", ""),
            "colors": front.get("colors", []),
            "rarity": card["rarity"],
            "keywords": card.get("keywords", []),
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
            "scryfall_uri": card["scryfall_uri"],
            "is_instant": "Instant" in front["type_line"],
        }
    return {
        "id": card["id"],
        "name": card["name"],
        "mana_cost": card.get("mana_cost", ""),
        "cmc": card["cmc"],
        "type_line": card["type_line"],
        "oracle_text": card.get("oracle_text", ""),
        "colors": card.get("colors", []),
        "rarity": card["rarity"],
        "keywords": card.get("keywords", []),
        "images": [{"label": card["name"], "url": card.get("image_uris", {}).get("normal")}],
        "back_face": None,
        "scryfall_uri": card["scryfall_uri"],
        "is_instant": "Instant" in card["type_line"],
    }


def main():
    cards = fetch_all(URL)
    trimmed = [trim(c) for c in cards]
    trimmed.sort(key=lambda c: (c["cmc"], c["name"]))
    OUT_PATH.write_text(json.dumps(trimmed, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(trimmed)} cards to {OUT_PATH}")


if __name__ == "__main__":
    main()
