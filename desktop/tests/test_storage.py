"""SQLite 存储层单元测试：python -m unittest discover -s desktop/tests -v"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import storage  # noqa: E402
from storage import NORMALIZED_TABLES, Store, default_db_path, program_dir  # noqa: E402


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
        "history": [
            {"t": 1763200000000, "mode": "sentence", "unit": "Unit 1",
             "cn": "今天很冷。", "en": "It is cold today.",
             "ok": 1, "assisted": 0, "ms": 8200, "bad": 0},
            {"t": 1763200005000, "mode": "chunk", "unit": "Unit 1",
             "cn": "下雪了。", "en": "It is snowing.",
             "ok": 0, "assisted": 1, "ms": 15000, "bad": 2},
        ],
        "plan": {"enabled": True, "type": "units", "target": 3, "points": 42,
                 "ledger": [{"t": 1763200010000, "delta": 20, "reason": "计划达标"}]},
        "lottery": {"cost": 10, "prizes": [{"id": "p1", "name": "小贴纸", "prob": 10}],
                    "log": [{"t": 1763200020000, "cost": 10, "prize": "小贴纸"}]},
        "session": {"mode": "sentence", "unitId": "u6", "qPos": 2, "draft": ["It"]},
        # 家长密码只存 salt + 哈希，样例里也不应出现明文密码
        "parent": {"salt": "test-salt", "hash": "a" * 32, "changed": True},
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
        self.assertEqual(counts["history"], 2)
        self.assertEqual(counts["plan_ledger"], 1)
        self.assertEqual(counts["prizes"], 1)
        self.assertEqual(counts["lottery_log"], 1)
        self.assertEqual(counts["app_meta"], 4)

        import sqlite3
        conn = sqlite3.connect(str(self.path))
        try:
            row = conn.execute(
                "SELECT en,hints,chunks FROM questions WHERE unit_id='tb:tb1:u1'"
            ).fetchone()
            self.assertEqual(row[0], "It is cold today.")
            self.assertEqual(json.loads(row[1]), ["它", "是", "冷的", "今天"])
            self.assertEqual(json.loads(row[2]), [["天气", 3], ["今天", 1]])
            hist = conn.execute(
                "SELECT en,ok,ms,bad FROM history ORDER BY t DESC LIMIT 1").fetchone()
            self.assertEqual(hist, ("It is snowing.", 0, 15000, 2))
            self.assertEqual(conn.execute("SELECT delta,reason FROM plan_ledger").fetchone(),
                             (20, "计划达标"))
            self.assertEqual(conn.execute("SELECT name,prob FROM prizes").fetchone(),
                             ("小贴纸", 10))
            self.assertEqual(conn.execute("SELECT prize FROM lottery_log").fetchone(),
                             ("小贴纸",))
            self.assertEqual(json.loads(
                conn.execute("SELECT v FROM app_meta WHERE k='session'").fetchone()[0])["qPos"], 2)
            parent = json.loads(
                conn.execute("SELECT v FROM app_meta WHERE k='parent'").fetchone()[0])
            self.assertEqual(parent["hash"], "a" * 32)
            self.assertEqual(parent["changed"], True)
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

    def test_reset_does_not_revive_backup(self):
        """用户明确清空后重启，旧备份不能再次自动导入。"""
        backup = {"format": "spelllab.backup.v1", "state": {"stats": {"attempted": 77}}}
        (Path(self.tmp.name) / "spelllab-backup.json").write_text(
            json.dumps(backup), encoding="utf-8")
        self.assertTrue(self.store.auto_migrate()["migrated"])
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 77)

        self.store.reset()
        reopened = Store(self.path)
        self.assertFalse(reopened.auto_migrate()["migrated"])
        self.assertIsNone(reopened.load())

    def test_stale_save_does_not_overwrite_newer_state(self):
        """迟到的旧快照不能覆盖新状态；旧客户端不带时间戳仍可写入。"""
        self.store.save({"stats": {"attempted": 1}, "__clientSavedAt": 20000})
        result = self.store.save({"stats": {"attempted": 99}, "__clientSavedAt": 10000})
        self.assertTrue(result["stale"])
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 1)
        self.assertNotIn("__clientSavedAt", self.store.load()["state"])

        self.store.save({"stats": {"attempted": 7}})
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 7)

    def test_rejects_non_object(self):
        with self.assertRaises(ValueError):
            self.store.save(["not", "a", "dict"])

    def test_all_tables_declared(self):
        self.assertEqual(len(NORMALIZED_TABLES), 15)
        for name in ("history", "plan_ledger", "prizes", "lottery_log", "app_meta"):
            self.assertIn(name, NORMALIZED_TABLES)

    def test_source_db_path_is_next_to_module(self):
        from unittest.mock import patch
        with patch.dict(os.environ):
            os.environ.pop("SPELLLAB_DB", None)
            self.assertEqual(default_db_path().name, "spelllab.db")
            self.assertEqual(default_db_path().parent.name, "data")
        self.assertEqual(program_dir().resolve(), Path(storage.__file__).resolve().parent)

    def test_env_override_shares_db_with_packaged_exe(self):
        """run.bat 用 SPELLLAB_DB 指向 exe 同目录，两个入口读同一个文件。"""
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            shared = Path(tmp) / "dist" / "data" / "spelllab.db"
            with patch.dict(os.environ, {"SPELLLAB_DB": str(shared)}):
                self.assertEqual(default_db_path(), shared.resolve())
                a = Store()
                a.save(sample_state())
            b = Store(shared)
            self.assertEqual(b.load()["state"]["stats"]["attempted"], 9)
            self.assertEqual(b.info()["counts"]["history"], 2)

    def test_frozen_db_path_is_next_to_exe_not_temp_dir(self):
        """PyInstaller 单文件模式下 _MEIxxxx 是临时目录，退出即删，不能存数据。"""
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            fake_exe = Path(tmp) / "SpellLab.exe"
            with patch.object(storage.sys, "frozen", True, create=True), \
                    patch.object(storage.sys, "executable", str(fake_exe), create=True):
                path = default_db_path()
            self.assertEqual(path.name, "spelllab.db")
            self.assertEqual(path.parent.name, "data")
            self.assertEqual(path.parent.parent.resolve(), Path(tmp).resolve())
            self.assertNotIn("_MEI", str(path))


if __name__ == "__main__":
    unittest.main()
