"""SpellLab 桌面版入口（零第三方依赖）。

启动一个只监听 127.0.0.1 的本地服务，用 SQLite 保存全部学习数据，
再用 Edge/Chrome 的 --app 独立窗口（无地址栏）打开界面；
如果安装了 pywebview，加 --pywebview 可改用原生 WebView 窗口。

    python app.py                 # 自动选端口 + 打开独立窗口
    python app.py --port 8790
    python app.py --db D:/mydata/spelllab.db
    python app.py --no-browser    # 只起服务，自己开浏览器
    python app.py --pywebview     # 需要 pip install pywebview
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from storage import Store, default_db_path

APP_VERSION = "1.0.0"
MAX_BODY = 32 * 1024 * 1024

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass


def default_html_path() -> Path:
    base = Path(getattr(sys, "_MEIPASS", None) or Path(__file__).resolve().parents[1])
    return base / "SpellLab.html"


def build_html(path: Path, port: int) -> bytes:
    raw = path.read_text(encoding="utf-8")
    bridge = (
        '<script>window.__SPELLLAB_DESKTOP__='
        + json.dumps({"mode": "http", "version": APP_VERSION, "port": port, "base": "/api"})
        + ';</script>\n'
    )
    marker = "</head>"
    if marker not in raw:
        raise RuntimeError("SpellLab.html 缺少 </head>，无法注入桌面桥接标记")
    return raw.replace(marker, bridge + marker, 1).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "SpellLabDesktop/" + APP_VERSION

    def log_message(self, fmt, *args):
        if args and str(args[1] if len(args) > 1 else "").startswith("5"):
            sys.stderr.write("[SpellLab] " + (fmt % args) + "\n")

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _html(self):
        body = self.server.html_bytes
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        if length > MAX_BODY:
            raise ValueError("请求体过大（上限 32 MB）")
        return self.rfile.read(length)

    def _guard_host(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        if host not in ("127.0.0.1", "localhost", "::1"):
            self._json({"error": "只允许本机访问"}, 403)
            return False
        return True

    def _route(self, method: str):
        if not self._guard_host():
            return
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        store = self.server.store  # type: Store
        try:
            if method == "GET" and path in ("/", "/index.html", "/SpellLab.html"):
                return self._html()
            if method == "GET" and path == "/favicon.ico":
                self.send_response(204)
                self.end_headers()
                return
            if method == "GET" and path == "/api/ping":
                return self._json({"ok": True, "app": "SpellLab", "version": APP_VERSION,
                                   "desktop": True, "dbPath": str(store.db_path)})
            if method == "GET" and path == "/api/load":
                return self._json(store.load() or {"state": None, "savedAt": 0})
            if method == "GET" and path == "/api/info":
                return self._json(store.info())
            if method == "POST" and path == "/api/save":
                state = json.loads(self._body().decode("utf-8"))
                return self._json(store.save(state))
            if method == "POST" and path == "/api/export":
                payload = json.loads(self._body().decode("utf-8"))
                target = store.export_text(payload.get("text") or "",
                                           payload.get("filename") or "spelllab-backup.json")
                return self._json({"ok": True, "path": target})
            if method == "POST" and path == "/api/import":
                state = store.import_text(self._body().decode("utf-8"))
                result = store.save(state)
                return self._json({"ok": True, "state": state, "save": result})
            if method == "GET" and path == "/api/open-folder":
                folder = str(store.db_path.parent)
                if sys.platform == "win32":
                    os.startfile(folder)  # noqa: S606
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", folder])
                else:
                    subprocess.Popen(["xdg-open", folder])
                return self._json({"ok": True, "path": folder})
            if method == "POST" and path == "/api/reset":
                store.reset()
                return self._json({"ok": True})
            return self._json({"error": "未知接口 " + path}, 404)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            return self._json({"error": str(exc)}, 400)
        except Exception as exc:  # noqa: BLE001
            return self._json({"error": "服务端错误：" + str(exc)}, 500)

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()


def port_in_use(port: int) -> bool:
    """主动探测 127.0.0.1:port 是否已有别的程序在监听。

    Windows 上 SO_REUSEADDR 允许两个进程绑定同一个 IP:端口，bind() 不会报错，
    结果后启动的程序以为自己占用成功，请求却落到先启动的程序上（例如本机
    8765 上另一个「MusicBox · 本地音乐库」）。所以不能只依赖 bind 是否抛异常。
    """
    if port == 0:
        return False
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.settimeout(0.25)
    try:
        return probe.connect_ex(("127.0.0.1", port)) == 0
    finally:
        probe.close()


def make_server(port: int, store: Store):
    requested = port
    for candidate in [port] + list(range(port + 1, port + 20)) + [0]:
        if port_in_use(candidate):
            continue
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate), Handler)
            break
        except OSError:
            continue
    else:
        raise RuntimeError("无法绑定本地端口")
    actual = server.server_address[1]
    if requested and actual != requested:
        print("  端口 %d 已被其他程序占用，本程序改用 %d" % (requested, actual), flush=True)
    server.daemon_threads = True
    server.store = store
    server.html_bytes = b""
    return server


def make_profile_dir(data_dir: Path, port: int) -> Path:
    """每次启动用独立的浏览器用户目录。

    Edge/Chrome 在 --user-data-dir 已有实例时，会把新窗口请求转交给旧实例，
    自己立刻退出；若只依赖 proc.wait()，服务会被误关，窗口随后显示"无法访问"。
    独立目录可保证启动进程就是窗口进程，wait() 才对应真实的窗口生命周期。
    """
    root = data_dir / "browser-profiles"
    root.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - 3 * 24 * 3600
    for old in root.glob("profile-*"):
        try:
            if old.is_dir() and old.stat().st_mtime < cutoff:
                shutil.rmtree(old, ignore_errors=True)
        except OSError:
            pass
    return root / ("profile-%d-%d" % (port, os.getpid()))


def find_browser() -> str:
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for path in candidates:
        if path and Path(path).is_file():
            return path
    for name in ("msedge", "chrome", "google-chrome", "chromium"):
        from shutil import which
        found = which(name)
        if found:
            return found
    return ""


def open_app_window(url: str, profile_dir: Path):
    browser = find_browser()
    if not browser:
        print("  未找到 Edge / Chrome，已改用默认浏览器打开。")
        import webbrowser
        webbrowser.open(url)
        return None
    profile_dir.mkdir(parents=True, exist_ok=True)
    args = [
        browser,
        "--app=" + url,
        "--window-size=1280,880",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--user-data-dir=" + str(profile_dir),
    ]
    try:
        return subprocess.Popen(args)
    except OSError as exc:
        print("  启动独立窗口失败（%s），已改用默认浏览器。" % exc)
        import webbrowser
        webbrowser.open(url)
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(description="SpellLab 桌面版")
    parser.add_argument("--port", type=int, default=8790, help="本地服务端口，默认 8790；被占用则自动顺延")
    parser.add_argument("--db", help="SQLite 数据库路径，默认 desktop/data/spelllab.db")
    parser.add_argument("--html", help="SpellLab.html 路径")
    parser.add_argument("--no-browser", action="store_true", help="只启动服务，不打开窗口")
    parser.add_argument("--pywebview", action="store_true", help="用 pywebview 原生窗口")
    args = parser.parse_args(argv)

    html_path = Path(args.html).resolve() if args.html else default_html_path()
    if not html_path.is_file():
        parser.error("找不到 SpellLab.html：" + str(html_path))

    store = Store(args.db)
    migration = store.auto_migrate()
    server = make_server(args.port, store)
    port = server.server_address[1]
    server.html_bytes = build_html(html_path, port)
    url = "http://127.0.0.1:%d/" % port

    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.2},
                              daemon=True)
    thread.start()

    print("=" * 58)
    print("  SpellLab 桌面版  v" + APP_VERSION)
    print("  地址     " + url)
    print("  数据库   " + str(store.db_path))
    if migration.get("migrated"):
        print("  已自动导入备份：" + migration.get("from", ""))
    print("  关闭窗口或按 Ctrl+C 结束程序")
    print("=" * 58, flush=True)

    profile_dir = None
    try:
        if args.pywebview:
            try:
                import webview
            except ImportError:
                print("  未安装 pywebview，请用 pip install pywebview，或去掉 --pywebview。")
                print("  本次已回退到独立浏览器窗口。")
                args.pywebview = False
            else:
                webview.create_window("SpellLab · 单词句子拼写记忆", url=url,
                                      width=1280, height=880, min_size=(900, 640))
                webview.start()
                return
        if args.no_browser:
            while True:
                threading.Event().wait(3600)
        else:
            profile_dir = make_profile_dir(store.db_path.parent, port)
            proc = open_app_window(url, profile_dir)
            if proc is None:
                while True:
                    threading.Event().wait(3600)
            else:
                started = time.monotonic()
                proc.wait()
                if time.monotonic() - started < 2.0:
                    # 正常窗口会一直存活；秒退说明浏览器复用了已有实例或启动异常，
                    # 此时绝不能关服务，否则窗口会立刻变成"连接被拒绝"。
                    print("  浏览器窗口由已有实例接管，服务保持运行。", flush=True)
                    print("  需要停止时请结束本程序进程。", flush=True)
                    while True:
                        threading.Event().wait(3600)
    except KeyboardInterrupt:
        pass
    finally:
        # 窗口关闭时页面会触发 pagehide 并用 sendBeacon 补写最后一次状态。
        # 先留一点时间让这个请求落盘，再停服务；否则服务先退出会丢掉最后几条练习。
        time.sleep(1.2)
        server.shutdown()
        server.server_close()
        if profile_dir is not None:
            shutil.rmtree(profile_dir, ignore_errors=True)
        print("  已退出，数据保存在 " + str(store.db_path))


if __name__ == "__main__":
    main()
