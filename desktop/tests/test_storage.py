"""SQLite 存储层单元测试：python -m unittest discover -s desktop/tests -v"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from storage import NORMALIZED_TABLES, Store  # noqa: E402


def sample_state():
    return {
        "grades": [{"id": "g4", "name": "小学四年级"}],
        "books": [{"id": "b_hj", "name": "沪教版"}],
        "textbooks": [{
            "id": "tb1", "name": "测试教材", "gradeId": "g4", "bookId": "b_hj",
            "enabled": True, "created": "2026-11-15",
            "units": [{
                "id": "u1", "name": "Unit 1",
                "sentences": [{
                    "cn": "今天很冷。", "en": "It is cold today.",
                    "hints": ["它", "是", "冷的", "今天"],
                    "chunks": [["天气", 3], ["今天", 1]],
                }],
                "words": [["cold", "冷的"], ["today", "今天"]],
            }],
        }],
        "custom": [{"cn": "旧题", "en": "It is old.", "hints": ["它", "是", "旧的"]}],
        "practiceSets": [{
            "id": "ps1", "name": "单元测", "sentences": [
                {"cn": "雪", "en": "snow", "hints": ["雪"]}],
            "words": [["snow", "雪"]],
        }],
        "vocab": [{"id": "v1", "en": "snow", "cn": "雪", "m": 2, "ok": 3, "bad": 0}],
        "progress": {"u6:0": {"m": 2, "ok": 1, "bad": 0}},
        "wrong": [{"id": "w1", "unitId": "u6", "idx": 0, "cn": "错题"}],
        "stats": {"attempted": 9, "correct": 7},
    }


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "spelllab.db"
        self.store = Store(self.path)

    def tearDown(self):
        self.tmp.cleanup()

    def test_empty_database(self):
        self.assertIsNone(self.store.load())
        info = self.store.info()
        self.assertEqual(info["dbPath"], str(self.path))
        self.assertEqual(info["counts"]["questions"], 0)
        self.assertEqual(info["schema"], 1)

    def test_roundtrip(self):
        state = sample_state()
        result = self.store.save(state)
        self.assertTrue(result["normalized"])
        self.assertGreater(result["bytes"], 100)
        loaded = self.store.load()
        self.assertEqual(loaded["state"]["stats"]["attempted"], 9)
        self.assertEqual(len(loaded["state"]["textbooks"]), 1)
        self.assertEqual(loaded["savedAt"], result["savedAt"])

    def test_normalized_tables_are_queryable(self):
        self.store.save(sample_state())
        info = self.store.info()
        counts = info["counts"]
        self.assertEqual(counts["grades"], 1)
        self.assertEqual(counts["books"], 1)
        self.assertEqual(counts["packs"], 1)
        self.assertEqual(counts["units"], 3)       # tb + custom + ps
        self.assertEqual(counts["questions"], 3)   # 1 + 1 + 1
        self.assertEqual(counts["words"], 3)       # 2 + 1
        self.assertEqual(counts["vocab"], 1)
        self.assertEqual(counts["progress"], 1)
        self.assertEqual(counts["wrong"], 1)
        self.assertEqual(counts["stats"], 2)

        import sqlite3
        conn = sqlite3.connect(str(self.path))
        try:
            row = conn.execute(
                "SELECT en,hints,chunks FROM questions WHERE unit_id='tb:tb1:u1'"
            ).fetchone()
            self.assertEqual(row[0], "It is cold today.")
            self.assertEqual(json.loads(row[1]), ["它", "是", "冷的", "今天"])
            self.assertEqual(json.loads(row[2]), [["天气", 3], ["今天", 1]])
        finally:
            conn.close()

    def test_same_content_skips_normalized_rebuild(self):
        state = sample_state()
        self.assertTrue(self.store.save(state)["normalized"])
        self.assertFalse(self.store.save(state)["normalized"])
        changed = dict(state)
        changed["stats"] = dict(state["stats"], attempted=10)
        self.assertTrue(self.store.save(changed)["normalized"])
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 10)

    def test_reopen_preserves_data(self):
        self.store.save(sample_state())
        reopened = Store(self.path)
        self.assertEqual(reopened.load()["state"]["stats"]["correct"], 7)
        self.assertEqual(reopened.info()["counts"]["questions"], 3)

    def test_export_import_backup(self):
        payload = {"format": "spelllab.backup.v1", "state": sample_state()}
        text = json.dumps(payload, ensure_ascii=False)
        path = self.store.export_text(text, "spelllab-backup-test.json")
        self.assertTrue(Path(path).is_file())
        restored = self.store.import_text(Path(path).read_text(encoding="utf-8"))
        self.assertEqual(restored["stats"]["attempted"], 9)
        with self.assertRaises(ValueError):
            self.store.import_text('{"format":"spelllab.textbook.v1","packs":[]}')

    def test_auto_migrate_from_browser_backup(self):
        payload = {"format": "spelllab.backup.v1", "state": sample_state()}
        (self.path.parent / "spelllab-backup.json").write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        result = self.store.auto_migrate()
        self.assertTrue(result["migrated"])
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 9)
        self.assertFalse(self.store.auto_migrate()["migrated"])

    def test_reset_clears_both_snapshot_and_tables(self):
        self.store.save(sample_state())
        self.store.reset()
        self.assertIsNone(self.store.load())
        self.assertTrue(all(v == 0 for v in self.store.info()["counts"].values()))

    def test_rejects_non_object(self):
        with self.assertRaises(ValueError):
            self.store.save(["not", "a", "dict"])

    def test_all_tables_declared(self):
        self.assertEqual(len(NORMALIZED_TABLES), 10)


if __name__ == "__main__":
    unittest.main()
