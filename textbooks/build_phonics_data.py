#!/usr/bin/env python3
"""Generate syllable-split reference data for SpellLab textbooks.

The bulk candidates come from Pyphen's LibreOffice hyphenation dictionaries.
Hyphenation is tuned for line breaks, so it is stored as a *reference* only.
The ``curated`` entries are the ones the app actually uses; they were checked
against Merriam-Webster / Cambridge headword syllable dots and teaching usage.

Install the dev-only dependency first::

    .venv/Scripts/python.exe -m pip install pyphen

Then run::

    .venv/Scripts/python.exe textbooks/build_phonics_data.py
"""

from __future__ import annotations

import glob
import json
from pathlib import Path

from pyphen import Pyphen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "textbooks" / "phonics-syllables.json"

# Verified teaching splits. The app reads these, not the raw hyphenation data.
CURATED = {
    "ability": "a|bil|i|ty",
    "activity": "ac|tiv|i|ty",
    "apple": "ap|ple",
    "autumn": "au|tumn",
    "banana": "ba|na|na",
    "basket": "bas|ket",
    "beautiful": "beau|ti|ful",
    "because": "be|cause",
    "blue": "blue",
    "bread": "bread",
    "breakfast": "break|fast",
    "cabin": "cab|in",
    "centimeter": "cen|ti|me|ter",
    "centimetre": "cen|ti|me|tre",
    "children": "chil|dren",
    "computer": "com|pu|ter",
    "dictionary": "dic|tion|ary",
    "diet": "di|et",
    "family": "fam|i|ly",
    "gingerbread": "gin|ger|bread",
    "happy": "hap|py",
    "hopeful": "hope|ful",
    "information": "in|for|ma|tion",
    "instruct": "in|struct",
    "jumping": "jump|ing",
    "kilometer": "ki|lo|me|ter",
    "kilometre": "ki|lo|me|tre",
    "lion": "li|on",
    "little": "lit|tle",
    "meter": "me|ter",
    "metre": "me|tre",
    "millimeter": "mil|li|me|ter",
    "millimetre": "mil|li|me|tre",
    "never": "nev|er",
    "purple": "pur|ple",
    "quickly": "quick|ly",
    "rabbit": "rab|bit",
    "readable": "read|able",
    "reading": "read|ing",
    "ready": "read|y",
    "real": "real",
    "really": "re|al|ly",
    "recent": "re|cent",
    "replay": "re|play",
    "respect": "re|spect",
    "rest": "rest",
    "result": "re|sult",
    "restaurant": "res|tau|rant",
    "sauce": "sauce",
    "seven": "sev|en",
    "table": "ta|ble",
    "teacher": "tea|cher",
    "tiger": "ti|ger",
    "true": "true",
    "window": "win|dow",
}


def collect_words() -> list[str]:
    words: set[str] = set()
    for name in glob.glob(str(ROOT / "textbooks" / "*.json")):
        if name.endswith("phonics-syllables.json"):
            continue
        data = json.loads(Path(name).read_text(encoding="utf-8"))

        def walk(node: object) -> None:
            if isinstance(node, dict):
                entries = node.get("words")
                if isinstance(entries, list):
                    for item in entries:
                        if isinstance(item, (list, tuple)) and item:
                            words.add(str(item[0]).strip().lower())
                        elif isinstance(item, dict) and item.get("en"):
                            words.add(str(item["en"]).strip().lower())
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk(data)
    return sorted(w for w in words if w and w.isalpha())


def main() -> None:
    us = Pyphen(lang="en_US")
    gb = Pyphen(lang="en_GB")
    reference = {
        word: {"en_US": us.inserted(word), "en_GB": gb.inserted(word)}
        for word in collect_words()
    }
    payload = {
        "meta": {
            "purpose": "SpellLab 拼读音节拆分参考数据 / syllable reference",
            "sourcePriority": [
                "Merriam-Webster / Cambridge headword dots: 人工校订依据",
                "Pyphen + LibreOffice hyphenation dictionaries: 批量候选",
                "Current phonicsChunks rules: 无词典条目时的兜底",
            ],
            "sources": [
                {
                    "name": "Pyphen (LibreOffice hyphenation dictionaries)",
                    "url": "https://pyphen.org/",
                    "license": "GPL-2.0+ / LGPL-2.1+ / MPL-1.1",
                },
                {"name": "Merriam-Webster Dictionary", "url": "https://www.merriam-webster.com/"},
                {"name": "Cambridge Dictionary", "url": "https://dictionary.cambridge.org/"},
            ],
            "note": "hyphenation 服务于断行，不等于教学音节；reference 仅供人工校对，app 使用 curated。",
        },
        "curated": {k: v.split("|") for k, v in sorted(CURATED.items())},
        "reference": reference,
    }
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT} ({len(reference)} words, {len(CURATED)} curated)")


if __name__ == "__main__":
    main()
