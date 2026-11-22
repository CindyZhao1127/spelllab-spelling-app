"""本地 HTTP 服务单元测试：启动真实服务并用 urllib 打接口。"""
import json
import os
import socket
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = DESKTOP_DIR.parent
sys.path.insert(0, str(DESKTOP_DIR))
import app  # noqa: E402
from storage import Store  # noqa: E402


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.store = Store(Path(cls.tmp.name) / "server.db")
        cls.server = app.make_server(0, cls.store)
        cls.port = cls.server.server_address[1]
        cls.server.html_bytes = app.build_html(ROOT_DIR / "SpellLab.html", cls.port)
        cls.thread = threading.Thread(
            target=cls.server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def setUp(self):
        # 服务用例共享一个实例，每个用例都从空库开始，避免顺序依赖
        self.store.reset()

    def call(self, path, payload=None, host=None, raw=False):
        url = "http://127.0.0.1:%d%s" % (self.port, path)
        headers = {}
        data = None
        if payload is not None:
            data = payload if raw else json.dumps(payload, ensure_ascii=False)
            data = data.encode("utf-8") if isinstance(data, str) else data
            headers["Content-Type"] = "application/json"
        if host:
            headers["Host"] = host
        req = urllib.request.Request(url, data=data, headers=headers,
                                     method="POST" if data is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = resp.read()
                return resp.status, body
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()

    def jcall(self, path, payload=None, **kw):
        status, body = self.call(path, payload, **kw)
        return status, json.loads(body.decode("utf-8"))

    def test_occupied_port_is_skipped(self):
        """端口已被别的程序监听时必须顺延，不能误绑到同一个 IP:端口上。"""
        blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        blocker.bind(("127.0.0.1", 0))
        blocker.listen(1)
        occupied = blocker.getsockname()[1]
        tmp = tempfile.TemporaryDirectory()
        server = None
        thread = None
        try:
            store = Store(Path(tmp.name) / "occupied.db")
            server = app.make_server(occupied, store)
            actual = server.server_address[1]
            self.assertNotEqual(actual, occupied)
            server.html_bytes = app.build_html(ROOT_DIR / "SpellLab.html", actual)
            thread = threading.Thread(
                target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
            thread.start()
            with urllib.request.urlopen(
                    "http://127.0.0.1:%d/api/ping" % actual, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["app"], "SpellLab")
        finally:
            if thread is not None:
                server.shutdown()
            if server is not None:
                server.server_close()
            if thread is not None:
                thread.join(timeout=2)
            blocker.close()
            tmp.cleanup()

    def test_occupied_port_is_not_reported_as_our_service(self):
        """端口探测必须区分"被别人占用"与"空闲"。"""
        self.assertFalse(app.port_in_use(0))
        blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        blocker.bind(("127.0.0.1", 0))
        blocker.listen(1)
        occupied = blocker.getsockname()[1]
        try:
            self.assertTrue(app.port_in_use(occupied))
        finally:
            blocker.close()

    def test_html_injects_desktop_marker(self):
        status, body = self.call("/")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn("window.__SPELLLAB_DESKTOP__", text)
        self.assertIn('"port"', text)
        self.assertIn(str(self.port), text)
        self.assertIn("SpellLab", text)
        self.assertIn("</head>", text)

    def test_ping(self):
        status, data = self.jcall("/api/ping")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertTrue(data["desktop"])
        self.assertIn("server.db", data["dbPath"])

    def test_load_save_roundtrip(self):
        status, empty = self.jcall("/api/load")
        self.assertEqual(status, 200)
        self.assertIsNone(empty["state"])

        state = {
            "stats": {"attempted": 12, "correct": 9},
            "textbooks": [{"id": "p1", "name": "包", "units": [{
                "id": "u1", "name": "Unit 1",
                "sentences": [{"cn": "你好", "en": "Hello.", "hints": ["你好"]}],
                "words": [["hello", "你好"]],
            }]}],
            "vocab": [{"id": "v1", "en": "hello", "cn": "你好", "m": 1}],
        }
        status, saved = self.jcall("/api/save", state)
        self.assertEqual(status, 200)
        self.assertTrue(saved["hash"])
        status, loaded = self.jcall("/api/load")
        self.assertEqual(loaded["state"]["stats"]["attempted"], 12)
        self.assertEqual(loaded["savedAt"], saved["savedAt"])

        status, info = self.jcall("/api/info")
        self.assertEqual(info["counts"]["questions"], 1)
        self.assertEqual(info["counts"]["vocab"], 1)
        self.assertGreater(info["size"], 0)

    def test_export_writes_file(self):
        payload = {"format": "spelllab.backup.v1", "state": {"stats": {"attempted": 3}}}
        status, data = self.jcall("/api/export", {
            "text": json.dumps(payload, ensure_ascii=False),
            "filename": "unit-test-backup.json",
        })
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertTrue(Path(data["path"]).is_file())
        self.assertIn("unit-test-backup.json", data["path"])

    def test_import_valid_and_invalid(self):
        payload = {"format": "spelllab.backup.v1", "state": {"stats": {"attempted": 77}}}
        status, data = self.jcall("/api/import", json.dumps(payload, ensure_ascii=False), raw=True)
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 77)

        status, bad = self.jcall("/api/import", "not-json", raw=True)
        self.assertEqual(status, 400)
        self.assertIn("error", bad)

    def test_unknown_route_and_host_guard(self):
        status, data = self.jcall("/api/nope")
        self.assertEqual(status, 404)
        self.assertIn("error", data)
        status, data = self.jcall("/api/ping", host="evil.example.com")
        self.assertEqual(status, 403)

    def post_with_origin(self, path, payload, origin, content_type="application/json"):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": content_type}
        if origin is not None:
            headers["Origin"] = origin
        req = urllib.request.Request(
            "http://127.0.0.1:%d%s" % (self.port, path), data=data,
            headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()

    def test_cross_origin_write_is_blocked(self):
        """外部网页的跨站 POST 不能覆写本地数据，即使是 text/plain。"""
        status, _ = self.post_with_origin(
            "/api/save", {"stats": {"attempted": 999}},
            "https://evil.example.com", "text/plain;charset=UTF-8")
        self.assertEqual(status, 403)
        self.assertIsNone(self.store.load())

        status, _ = self.post_with_origin(
            "/api/save", {"stats": {"attempted": 5}},
            "http://127.0.0.1:%d" % self.port)
        self.assertEqual(status, 200)
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 5)

    def test_reset_requires_explicit_confirm(self):
        self.jcall("/api/save", {"stats": {"attempted": 7}})
        status, data = self.jcall("/api/reset", {})
        self.assertEqual(status, 400)
        self.assertIn("confirm", data["error"])
        self.assertIsNotNone(self.store.load())
        status, data = self.jcall("/api/reset", {"confirm": True})
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertIsNone(self.store.load())

    def test_beacon_save_with_plain_content_type(self):
        """关窗时 sendBeacon 可能带 text/plain；服务端不能依赖 Content-Type 解析。"""
        payload = json.dumps({
            "stats": {"attempted": 3},
            "history": [{"t": 1763200000000, "mode": "sentence", "unit": "Unit 1",
                         "cn": "今天很冷。", "en": "It is cold today.",
                         "ok": 1, "assisted": 0, "ms": 5000, "bad": 0}],
        }, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:%d/api/save" % self.port, data=payload,
            headers={"Content-Type": "text/plain;charset=UTF-8"}, method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            self.assertTrue(json.loads(resp.read().decode("utf-8"))["normalized"])
        self.assertEqual(self.store.load()["state"]["stats"]["attempted"], 3)
        self.assertEqual(self.store.info()["counts"]["history"], 1)

    def test_favicon(self):
        status, _ = self.call("/favicon.ico")
        self.assertEqual(status, 204)


class ProfileDirTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_profile_is_unique_per_port_and_process(self):
        first = app.make_profile_dir(self.root, 8790)
        second = app.make_profile_dir(self.root, 8792)
        self.assertNotEqual(first, second)
        self.assertTrue(first.parent.is_dir())
        self.assertTrue(first.name.startswith("profile-8790-"))
        self.assertIn(str(os.getpid()), first.name)

    def test_stale_profiles_are_pruned(self):
        stale = self.root / "browser-profiles" / "profile-8790-1"
        stale.mkdir(parents=True)
        old = time.time() - 4 * 24 * 3600
        os.utime(stale, (old, old))
        app.make_profile_dir(self.root, 8790)
        self.assertFalse(stale.exists())


if __name__ == "__main__":
    unittest.main()
