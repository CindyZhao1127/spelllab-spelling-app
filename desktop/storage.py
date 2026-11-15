"""SpellLab 桌面版本地数据库。

- 表 state：全量状态的 JSON 快照（应用读写的权威副本）
- 其余表：把用户数据规范化展开，方便用任意 SQLite 工具直接查询
两者在每次写入时处于同一个事务，永远一致。
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
import threading
import time
from pathlib import Path

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS state(
  id INTEGER PRIMARY KEY CHECK(id = 1),
  payload TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS grades(id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS packs(
  id TEXT PRIMARY KEY, name TEXT, grade_id TEXT, book_id TEXT,
  enabled INTEGER, created TEXT
);
CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY, pack_id TEXT, name TEXT);
CREATE TABLE IF NOT EXISTS questions(
  unit_id TEXT, seq INTEGER, cn TEXT, en TEXT, hints TEXT, chunks TEXT
);
CREATE TABLE IF NOT EXISTS words(unit_id TEXT, en TEXT, cn TEXT);
CREATE TABLE IF NOT EXISTS vocab(
  id TEXT PRIMARY KEY, en TEXT, cn TEXT, source TEXT,
  grade_id TEXT, book_id TEXT, mastery INTEGER, ok INTEGER, bad INTEGER
);
CREATE TABLE IF NOT EXISTS progress(
  id TEXT PRIMARY KEY, mastery INTEGER, ok INTEGER, bad INTEGER
);
CREATE TABLE IF NOT EXISTS wrong(id TEXT PRIMARY KEY, unit_id TEXT, idx INTEGER, cn TEXT);
CREATE TABLE IF NOT EXISTS stats(k TEXT PRIMARY KEY, v TEXT);
"""

NORMALIZED_TABLES = [
    "grades", "books", "packs", "units", "questions", "words",
    "vocab", "progress", "wrong", "stats",
]


def program_dir() -> Path:
    """返回程序所在目录。

    源码运行时是 desktop/；PyInstaller 单文件打包后 __file__ 指向临时解压目录
    _MEIxxxxxx（退出即被删除），必须改用 exe 自身所在目录，否则数据会丢失。
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def default_db_path() -> Path:
    """优先放在程序旁的 data/ 目录，方便直接看到 .db 文件；不可写时回退到 APPDATA。"""
    base = program_dir() / "data"
    try:
        base.mkdir(parents=True, exist_ok=True)
        probe = base / ".writetest"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return base / "spelllab.db"
    except OSError:
        fallback = Path(os.environ.get("APPDATA") or str(Path.home())) / "SpellLab"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback / "spelllab.db"


def _s(value) -> str:
    return "" if value is None else str(value)


def _j(value) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return "[]"


class Store:
    def __init__(self, db_path=None):
        self.db_path = Path(db_path).resolve() if db_path else default_db_path()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._last_hash = None
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=15)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    def _init_db(self):
        conn = self._connect()
        try:
            conn.executescript(SCHEMA)
            conn.execute(
                "INSERT OR IGNORE INTO meta(key,value) VALUES('schema_version',?)",
                (str(SCHEMA_VERSION),),
            )
            conn.commit()
        finally:
            conn.close()

    def load(self):
        """返回 {'state': dict, 'savedAt': int}，空库返回 None。"""
        with self._lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    "SELECT payload, saved_at, hash FROM state WHERE id = 1"
                ).fetchone()
                if not row:
                    return None
                self._last_hash = row[2]
                return {"state": json.loads(row[0]), "savedAt": row[1]}
            finally:
                conn.close()

    def save(self, state: dict) -> dict:
        """事务写入全量快照；内容变化时才重建规范化表。"""
        if not isinstance(state, dict):
            raise ValueError("state 必须是对象")
        raw = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        saved_at = int(time.time() * 1000)
        changed = digest != self._last_hash
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("BEGIN IMMEDIATE")
                conn.execute(
                    "INSERT OR REPLACE INTO state(id,payload,saved_at,hash) VALUES(1,?,?,?)",
                    (raw, saved_at, digest),
                )
                if changed:
                    self._rebuild(conn, state)
                conn.commit()
                self._last_hash = digest
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        return {
            "savedAt": saved_at,
            "hash": digest,
            "normalized": changed,
            "bytes": len(raw.encode("utf-8")),
        }

    def _rebuild(self, conn: sqlite3.Connection, state: dict):
        for table in NORMALIZED_TABLES:
            conn.execute("DELETE FROM " + table)

        for g in state.get("grades") or []:
            conn.execute("INSERT OR REPLACE INTO grades VALUES(?,?)",
                         (_s(g.get("id")), _s(g.get("name"))))
        for b in state.get("books") or []:
            conn.execute("INSERT OR REPLACE INTO books VALUES(?,?)",
                         (_s(b.get("id")), _s(b.get("name"))))

        def add_unit(uid, pack_id, name, sentences, word_list):
            conn.execute("INSERT OR REPLACE INTO units VALUES(?,?,?)",
                         (uid, pack_id, _s(name)))
            for i, q in enumerate(sentences or []):
                conn.execute(
                    "INSERT INTO questions VALUES(?,?,?,?,?,?)",
                    (uid, i, _s(q.get("cn")), _s(q.get("en")),
                     _j(q.get("hints") or []), _j(q.get("chunks") or [])),
                )
            for w in word_list or []:
                if isinstance(w, (list, tuple)):
                    en, cn = (list(w) + ["", ""])[:2]
                elif isinstance(w, dict):
                    en, cn = w.get("en", ""), w.get("cn", "")
                else:
                    continue
                conn.execute("INSERT INTO words VALUES(?,?,?)",
                             (uid, _s(en), _s(cn)))

        for p in state.get("textbooks") or []:
            conn.execute(
                "INSERT OR REPLACE INTO packs VALUES(?,?,?,?,?,?)",
                (_s(p.get("id")), _s(p.get("name")), _s(p.get("gradeId")),
                 _s(p.get("bookId")), 0 if p.get("enabled") is False else 1,
                 _s(p.get("created"))),
            )
            for u in p.get("units") or []:
                add_unit("tb:" + _s(p.get("id")) + ":" + _s(u.get("id")),
                         _s(p.get("id")), u.get("name"),
                         u.get("sentences"), u.get("words"))

        custom = state.get("custom") or []
        if custom:
            add_unit("custom", "custom", "我的题库 · 自定义", custom, [])

        for s in state.get("practiceSets") or []:
            add_unit("ps:" + _s(s.get("id")), "practice-sets",
                     "生词练习 · " + _s(s.get("name")),
                     s.get("sentences"), s.get("words"))

        for v in state.get("vocab") or []:
            conn.execute(
                "INSERT OR REPLACE INTO vocab VALUES(?,?,?,?,?,?,?,?,?)",
                (_s(v.get("id")), _s(v.get("en")), _s(v.get("cn")),
                 _s(v.get("source")), _s(v.get("gradeId")), _s(v.get("bookId")),
                 int(v.get("m") or 0), int(v.get("ok") or 0), int(v.get("bad") or 0)),
            )
        for key, val in (state.get("progress") or {}).items():
            conn.execute("INSERT OR REPLACE INTO progress VALUES(?,?,?,?)",
                         (key, int(val.get("m") or 0), int(val.get("ok") or 0),
                          int(val.get("bad") or 0)))
        for w in state.get("wrong") or []:
            conn.execute(
                "INSERT OR REPLACE INTO wrong VALUES(?,?,?,?)",
                (_s(w.get("id")), _s(w.get("unitId")),
                 int(w.get("idx") or 0), _s(w.get("cn"))),
            )
        for key, val in (state.get("stats") or {}).items():
            conn.execute("INSERT OR REPLACE INTO stats VALUES(?,?)",
                         (key, _j(val)))

    def info(self) -> dict:
        with self._lock:
            conn = self._connect()
            try:
                counts = {
                    t: conn.execute("SELECT COUNT(*) FROM " + t).fetchone()[0]
                    for t in NORMALIZED_TABLES
                }
                row = conn.execute("SELECT saved_at FROM state WHERE id = 1").fetchone()
            finally:
                conn.close()
        size = self.db_path.stat().st_size if self.db_path.exists() else 0
        return {
            "dbPath": str(self.db_path),
            "dbDir": str(self.db_path.parent),
            "size": size,
            "savedAt": row[0] if row else 0,
            "counts": counts,
            "schema": SCHEMA_VERSION,
        }

    def export_text(self, text: str, filename: str) -> str:
        """把备份 JSON 写到 data/exports/，返回绝对路径。"""
        safe = os.path.basename(filename or "spelllab-backup.json")
        folder = self.db_path.parent / "exports"
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / safe
        target.write_text(text, encoding="utf-8")
        return str(target)

    def import_text(self, text: str) -> dict:
        """导入全库备份或教材包 JSON，返回解析后的状态。"""
        data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError("备份文件顶层必须是对象")
        state = data.get("state") if data.get("format") == "spelllab.backup.v1" else None
        if not isinstance(state, dict):
            raise ValueError("不是有效的全库备份（缺少 state）")
        return state

    def auto_migrate(self) -> dict:
        """数据库为空时，自动导入同目录的浏览器备份 / 绑定数据文件。"""
        if self.load() is not None:
            return {"migrated": False}
        folder = self.db_path.parent
        candidates = sorted(
            [p for p in folder.glob("*.json")
             if p.name.startswith(("spelllab-data", "spelllab-backup"))],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for path in candidates:
            try:
                state = self.import_text(path.read_text(encoding="utf-8"))
                self.save(state)
                return {"migrated": True, "from": str(path)}
            except (ValueError, OSError, json.JSONDecodeError):
                continue
        return {"migrated": False}

    def reset(self):
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("BEGIN IMMEDIATE")
                conn.execute("DELETE FROM state")
                for table in NORMALIZED_TABLES:
                    conn.execute("DELETE FROM " + table)
                conn.commit()
                self._last_hash = None
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
