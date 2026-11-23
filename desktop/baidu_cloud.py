"""百度网盘 OAuth 直连（零第三方依赖，仅桌面版使用）。

配置与 token 只保存在本机数据目录，不写入 SpellLab.html / SQLite / 全库备份。
Windows 上用 DPAPI 加密配置文件；其他平台退化为普通 JSON 并提示风险。
上传走官方「预上传 -> 获取上传域名 -> 分片上传 -> 创建文件」流程，
下载走「filemetas 取 dlink -> GET dlink」流程，路径限定在 /apps/{appname}/。
"""
from __future__ import annotations

import base64
import ctypes
import hashlib
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

AUTH_URL = "https://openapi.baidu.com/oauth/2.0/authorize"
TOKEN_URL = "https://openapi.baidu.com/oauth/2.0/token"
PAN_HOST = "https://pan.baidu.com"
DEFAULT_REDIRECT = "http://127.0.0.1:8791/oauth/callback"
REMOTE_FOLDER = "SpellLab"
REMOTE_NAME = "spelllab-backup.json"
BLOCK = 4 * 1024 * 1024
UA = "pan.baidu.com"


class BaiduError(Exception):
    """携带百度业务错误码的异常，便于界面给出明确提示。"""


def safe_app_name(value: str) -> str:
    name = str(value or "").strip().strip("/")
    if not re.fullmatch(r"[\w\u4e00-\u9fa5 .-]{1,64}", name):
        raise ValueError("应用文件夹名不合法（只允许中文、字母、数字、空格、点、横线、下划线）")
    if ".." in name or "/" in name or "\\" in name:
        raise ValueError("应用文件夹名不能包含路径分隔符")
    return name


def remote_path(app_name: str) -> str:
    return "/apps/%s/%s/%s" % (safe_app_name(app_name), REMOTE_FOLDER, REMOTE_NAME)


def auth_url(app_key: str, redirect_uri: str, state: str) -> str:
    query = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": app_key,
        "redirect_uri": redirect_uri,
        "scope": "basic,netdisk",
        "display": "popup",
        "qrcode": "1",
        "state": state,
    })
    return AUTH_URL + "?" + query


def _blob(data: bytes):
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", ctypes.c_ulong),
                    ("pbData", ctypes.POINTER(ctypes.c_ubyte))]

    buf = ctypes.create_string_buffer(data, len(data)) if data else ctypes.create_string_buffer(1)
    return DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte))), buf


def _protect(data: bytes) -> bytes:
    if sys.platform != "win32":
        return b"PLAIN:" + base64.b64encode(data)
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    inp, _keep = _blob(data)
    out = type(inp)()
    if not crypt32.CryptProtectData(ctypes.byref(inp), None, None, None, None, 0, ctypes.byref(out)):
        raise OSError("DPAPI 加密失败")
    try:
        raw = ctypes.string_at(out.pbData, out.cbData)
    finally:
        kernel32.LocalFree(out.pbData)
    return b"DPAPI:" + base64.b64encode(raw)


def _unprotect(data: bytes) -> bytes:
    if data.startswith(b"PLAIN:"):
        return base64.b64decode(data[6:])
    if not data.startswith(b"DPAPI:"):
        return data  # 兼容早期明文配置
    if sys.platform != "win32":
        raise OSError("此文件受 Windows DPAPI 保护，无法在其他系统解密")
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    inp, _keep = _blob(base64.b64decode(data[6:]))
    out = type(inp)()
    if not crypt32.CryptUnprotectData(ctypes.byref(inp), None, None, None, None, 0, ctypes.byref(out)):
        raise OSError("DPAPI 解密失败（配置可能属于另一个 Windows 用户）")
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        kernel32.LocalFree(out.pbData)


def _request(url: str, method="GET", params=None, form=None, body=None,
             headers=None, timeout=25):
    params = {k: v for k, v in (params or {}).items() if v is not None}
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    data = None
    all_headers = {"User-Agent": UA}
    if form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
        all_headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif body is not None:
        data = body
    if headers:
        all_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=all_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _json_request(url: str, **kw):
    raw = _request(url, **kw)
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise BaiduError("百度返回了非 JSON 内容：" + str(exc)) from exc


def _multipart(field: str, filename: str, payload: bytes):
    boundary = "----SpellLabBoundary" + secrets.token_hex(12)
    head = (
        ("--" + boundary + "\r\n"
         'Content-Disposition: form-data; name="%s"; filename="%s"\r\n'
         "Content-Type: application/octet-stream\r\n\r\n") % (field, filename)
    ).encode("utf-8")
    tail = ("\r\n--%s--\r\n" % boundary).encode("utf-8")
    return head + payload + tail, "multipart/form-data; boundary=" + boundary


class _CallbackHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        cloud = self.server.cloud  # type: BaiduCloud
        parts = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parts.query)
        if parts.path != cloud.callback_path:
            self.send_error(404)
            return
        code = (query.get("code") or [""])[0]
        state = (query.get("state") or [""])[0]
        error = (query.get("error") or [""])[0]
        ok, message = cloud.finish_auth(code, state, error)
        html = ("<!doctype html><meta charset='utf-8'><title>SpellLab 授权</title>"
                "<div style='font:16px/1.8 system-ui;padding:48px;text-align:center'>"
                "<h2>%s</h2><p>%s</p><p>可以关闭此窗口，回到 SpellLab。</p></div>"
                % ("授权成功" if ok else "授权失败", message))
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        threading.Timer(0.4, self.server.shutdown).start()


class BaiduCloud:
    """配置、OAuth、备份上传/下载与冲突检测。线程安全由内部锁保护。"""

    def __init__(self, data_dir: Path, store=None):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.config_path = self.data_dir / "baidu-oauth.dat"
        self.store = store
        self.lock = threading.RLock()
        self.cfg = {}
        self.auth_state = ""
        self.auth_result = {"done": False, "ok": False, "error": ""}
        self.auth_server = None
        self.last_error = ""
        self._auto_timer = None
        self.load()

    # ---------- 配置 ----------
    def load(self):
        try:
            raw = self.config_path.read_bytes()
            self.cfg = json.loads(_unprotect(raw).decode("utf-8"))
        except FileNotFoundError:
            self.cfg = {}
        except Exception as exc:  # noqa: BLE001
            self.cfg = {}
            self.last_error = "读取网盘配置失败：" + str(exc)
        return self.cfg

    def save(self):
        raw = json.dumps(self.cfg, ensure_ascii=False, indent=2).encode("utf-8")
        payload = _protect(raw)
        tmp = self.config_path.with_suffix(".tmp")
        tmp.write_bytes(payload)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, self.config_path)

    def configure(self, data: dict):
        with self.lock:
            app_id = str(data.get("appId") or "").strip()
            app_key = str(data.get("appKey") or "").strip()
            secret = str(data.get("secretKey") or "").strip()
            old = self.cfg
            if not secret and app_key and app_key == old.get("appKey"):
                secret = str(old.get("secretKey") or "")  # 界面不回填密钥，留空表示沿用
            app_name = safe_app_name(data.get("appName"))
            redirect = str(data.get("redirectUri") or DEFAULT_REDIRECT).strip()
            parsed = urllib.parse.urlparse(redirect)
            if not parsed.hostname or parsed.hostname not in ("127.0.0.1", "localhost"):
                raise ValueError("回调地址必须指向 127.0.0.1 或 localhost")
            if parsed.scheme != "http":
                raise ValueError("本地回调地址只支持 http")
            if not app_id or not app_key or not secret:
                raise ValueError("AppID / AppKey / SecretKey 都不能为空")
            self.cfg = {
                "appId": app_id, "appKey": app_key, "secretKey": secret,
                "appName": app_name, "redirectUri": redirect,
                "auto": bool(data.get("auto")),
                "accessToken": old.get("accessToken", ""),
                "refreshToken": old.get("refreshToken", ""),
                "expiresAt": old.get("expiresAt", 0),
                "uid": old.get("uid", ""),
                "lastRemoteMd5": old.get("lastRemoteMd5", ""),
                "lastRemoteMtime": old.get("lastRemoteMtime", 0),
                "lastUpload": old.get("lastUpload", 0),
            }
            if old.get("appKey") != app_key or old.get("secretKey") != secret:
                # 换应用后旧 token 不再可用，必须重新授权
                self.cfg["accessToken"] = ""
                self.cfg["refreshToken"] = ""
                self.cfg["expiresAt"] = 0
                self.cfg["uid"] = ""
            self.save()
            self.last_error = ""
            return self.status()

    def disconnect(self):
        with self.lock:
            token = bool(self.cfg.get("accessToken"))
            self.cfg = {}
            try:
                self.config_path.unlink(missing_ok=True)
            except OSError:
                pass
            return {"ok": True, "hadToken": token}

    # ---------- OAuth ----------
    @property
    def callback_path(self):
        return urllib.parse.urlparse(self.cfg.get("redirectUri") or DEFAULT_REDIRECT).path or "/oauth/callback"

    @property
    def callback_port(self) -> int:
        """本地回调端口；主服务端口顺延必须避开它，否则授权码永远送不回来。"""
        try:
            return urllib.parse.urlparse(self.cfg.get("redirectUri") or DEFAULT_REDIRECT).port or 80
        except ValueError:
            return 80

    def start_auth(self, open_browser=True):
        with self.lock:
            if not self.cfg.get("appKey") or not self.cfg.get("secretKey"):
                raise ValueError("请先保存 AppID / AppKey / SecretKey")
            redirect = self.cfg["redirectUri"]
            parsed = urllib.parse.urlparse(redirect)
            port = parsed.port or 80
            if app_port_busy(port):
                raise BaiduError(
                    "回调端口 %d 已被占用。请关闭其他 SpellLab 窗口和旧进程后重试；"
                    "若确实有其他程序占用，需同时修改百度应用的安全设置里的回调地址。"
                    % port)
            # 重复点授权时先把上一次的监听停掉，避免端口残留。
            self._stop_auth_server()
            self.auth_state = secrets.token_urlsafe(18)
            self.auth_result = {"done": False, "ok": False, "error": ""}
            server = HTTPServer((parsed.hostname, port), _CallbackHandler)
            server.daemon_threads = True
            server.cloud = self
            self.auth_server = server
            thread = threading.Thread(target=server.serve_forever,
                                      kwargs={"poll_interval": 0.2}, daemon=True)
            thread.start()
            url = auth_url(self.cfg["appKey"], redirect, self.auth_state)
            if open_browser:
                try:
                    webbrowser.open(url)
                except Exception:  # noqa: BLE001
                    pass
            return {"url": url, "redirectUri": redirect, "state": self.auth_state}

    def finish_auth(self, code: str, state: str, error: str):
        with self.lock:
            if error:
                self.auth_result = {"done": True, "ok": False, "error": error}
                return False, "百度返回授权错误：" + error
            if state != self.auth_state:
                self.auth_result = {"done": True, "ok": False, "error": "state 校验失败"}
                return False, "state 校验失败，请重新发起授权"
            try:
                data = _json_request(TOKEN_URL, params={
                    "grant_type": "authorization_code", "code": code,
                    "client_id": self.cfg["appKey"],
                    "client_secret": self.cfg["secretKey"],
                    "redirect_uri": self.cfg["redirectUri"],
                })
                if not data.get("access_token"):
                    raise BaiduError(data.get("error_description") or "换取 token 失败")
                self.cfg["accessToken"] = data["access_token"]
                self.cfg["refreshToken"] = data.get("refresh_token", "")
                self.cfg["expiresAt"] = time.time() + int(data.get("expires_in") or 2592000)
                self.cfg["uid"] = str(data.get("uid") or "")
                self.cfg["lastRemoteMd5"] = ""
                self.cfg["lastUpload"] = 0
                self.save()
                self.last_error = ""
                self.auth_result = {"done": True, "ok": True, "error": ""}
                return True, "已授权并保存令牌"
            except Exception as exc:  # noqa: BLE001
                message = str(exc)
                self.auth_result = {"done": True, "ok": False, "error": message}
                self.last_error = message
                return False, message

    def auth_status(self):
        with self.lock:
            result = dict(self.auth_result)
            result["authorized"] = self.authorized()
            return result

    def _stop_auth_server(self):
        server, self.auth_server = self.auth_server, None
        if server:
            try:
                server.shutdown()
                server.server_close()
            except OSError:
                pass

    # ---------- Token ----------
    def authorized(self) -> bool:
        return bool(self.cfg.get("accessToken") and self.cfg.get("refreshToken"))

    def _token(self, force_refresh=False) -> str:
        with self.lock:
            token = self.cfg.get("accessToken", "")
            expires = float(self.cfg.get("expiresAt") or 0)
            if token and not force_refresh and expires > time.time() + 90:
                return token
            refresh = self.cfg.get("refreshToken", "")
            if not refresh:
                raise BaiduError("尚未授权百度网盘，请先点「授权登录」")
            data = _json_request(TOKEN_URL, params={
                "grant_type": "refresh_token", "refresh_token": refresh,
                "client_id": self.cfg.get("appKey", ""),
                "client_secret": self.cfg.get("secretKey", ""),
            })
            if not data.get("access_token"):
                raise BaiduError(data.get("error_description") or "刷新令牌失败，请重新授权")
            self.cfg["accessToken"] = data["access_token"]
            self.cfg["refreshToken"] = data.get("refresh_token") or refresh
            self.cfg["expiresAt"] = time.time() + int(data.get("expires_in") or 2592000)
            self.cfg["uid"] = str(data.get("uid") or self.cfg.get("uid", ""))
            self.save()
            return self.cfg["accessToken"]

    # ---------- 文件接口 ----------
    def _api(self, endpoint: str, method="GET", params=None, form=None, retry=True):
        token = self._token()
        ps = dict(params or {})
        ps["access_token"] = token
        url = PAN_HOST + endpoint
        try:
            data = _json_request(url, method=method, params=ps, form=form)
        except urllib.error.HTTPError as exc:
            data = {"errno": exc.code, "show_msg": str(exc)}
        code = int(data.get("errno", data.get("error_code", 0)) or 0)
        if code in (31045, 401) and retry:
            self._token(force_refresh=True)
            return self._api(endpoint, method=method, params=params, form=form, retry=False)
        if code not in (0, -8):
            raise BaiduError(str(data.get("show_msg") or data.get("error_msg") or
                                 ("百度接口错误 %s" % code)))
        return data

    def _ensure_folder(self):
        path = "/apps/%s/%s" % (safe_app_name(self.cfg["appName"]), REMOTE_FOLDER)
        self._api("/rest/2.0/xpan/file?method=create", method="POST", form={
            "path": path, "size": "0", "isdir": "1", "rtype": "3",
        })

    def _remote_meta(self):
        path = remote_path(self.cfg["appName"])
        data = self._api("/rest/2.0/xpan/file?method=filemetas", method="POST", form={
            "target": json.dumps([path], ensure_ascii=False), "dlink": "0", "blocks": "1",
        })
        info = ((data.get("info") or [{}])[0])
        if int(info.get("errno", 0) or 0) in (31066, -9):
            return None
        return info

    def _upload_one(self, payload: bytes, force=False):
        with self.lock:
            if not self.authorized():
                raise BaiduError("尚未授权百度网盘")
            path = remote_path(self.cfg["appName"])
            md5 = hashlib.md5(payload).hexdigest()
            if not force and self.cfg.get("lastRemoteMd5"):
                remote = self._remote_meta() or {}
                remote_md5 = str(remote.get("md5") or "")
                remote_mtime = int(remote.get("mtime") or 0)
                if (remote_md5 and remote_md5 != self.cfg["lastRemoteMd5"] and
                        remote_mtime > int(self.cfg.get("lastUpload") or 0) + 2):
                    raise BaiduError("云端备份已被另一台设备更新，请选择覆盖或从网盘恢复")
            self._ensure_folder()
            pre = self._api("/rest/2.0/xpan/file?method=precreate", method="POST", form={
                "path": path, "size": str(len(payload)), "isdir": "0", "autoinit": "1",
                "rtype": "3", "block_list": json.dumps([md5]),
                "content-md5": md5, "slice-md5": hashlib.md5(payload[:262144]).hexdigest(),
            })
            uploadid = str(pre.get("uploadid") or "")
            if not uploadid:
                raise BaiduError("预上传失败：云端未返回 uploadid")
            needed = pre.get("block_list") or [0]
            token = self._token()
            hosts = _json_request("https://d.pcs.baidu.com/rest/2.0/pcs/file", params={
                "method": "locateupload", "appid": "250528", "access_token": token,
                "path": path, "uploadid": uploadid, "upload_version": "2.0",
            })
            servers = hosts.get("servers") or []
            host = (servers[0].get("server") if servers else None) or hosts.get("host") or "https://d.pcs.baidu.com"
            if str(host).startswith("http://"):
                host = "https://" + host[7:]
            if not str(host).startswith("https://"):
                host = "https://" + str(host).strip("/")
            uploaded = {}
            for seq in needed:
                seq = int(seq)
                chunk = payload[seq * BLOCK:(seq + 1) * BLOCK]
                multipart, ctype = _multipart("file", REMOTE_NAME, chunk)
                raw = _request(
                    str(host).rstrip("/") + "/rest/2.0/pcs/superfile2",
                    method="POST",
                    params={"method": "upload", "access_token": token, "type": "tmpfile",
                            "path": path, "uploadid": uploadid, "partseq": str(seq)},
                    body=multipart, headers={"Content-Type": ctype},
                )
                res = json.loads(raw.decode("utf-8"))
                if int(res.get("errno", 0) or 0) != 0:
                    raise BaiduError(str(res.get("show_msg") or "分片上传失败"))
                uploaded[seq] = res.get("md5") or md5
            block_list = [uploaded.get(i) or md5 for i in range(max(needed) + 1)] if needed else [md5]
            created = self._api("/rest/2.0/xpan/file?method=create", method="POST", form={
                "path": path, "size": str(len(payload)), "isdir": "0", "rtype": "3",
                "uploadid": uploadid, "block_list": json.dumps(block_list),
            })
            now = int(time.time())
            self.cfg["lastRemoteMd5"] = str(created.get("md5") or md5)
            self.cfg["lastRemoteMtime"] = int(created.get("mtime") or now)
            self.cfg["lastUpload"] = now
            self.save()
            self.last_error = ""
            return {"ok": True, "path": path, "size": len(payload),
                    "md5": self.cfg["lastRemoteMd5"], "fs_id": created.get("fs_id", 0),
                    "uploadedAt": now}

    def upload_backup(self, text: str = "", force=False):
        payload = text.encode("utf-8") if text else self._payload_from_store()
        if not payload.strip():
            raise BaiduError("没有可上传的备份内容")
        if len(payload) > 256 * 1024 * 1024:
            raise BaiduError("备份超过 256 MB，暂不支持直传")
        return self._upload_one(payload, force=force)

    def _payload_from_store(self) -> bytes:
        if self.store is None:
            raise BaiduError("未连接本地数据库")
        state = (self.store.load() or {}).get("state") or {}
        payload = {"format": "spelllab.backup.v1",
                   "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "state": state}
        return json.dumps(payload, ensure_ascii=False).encode("utf-8")

    def download_backup(self):
        with self.lock:
            if not self.authorized():
                raise BaiduError("尚未授权百度网盘")
            path = remote_path(self.cfg["appName"])
            # target（路径）方式不需要先查 fs_id；dlink=1 直接返回下载直链。
            data = self._api("/rest/2.0/xpan/file?method=filemetas", method="POST", form={
                "target": json.dumps([path], ensure_ascii=False), "dlink": "1", "blocks": "1",
            })
            info = ((data.get("info") or [{}])[0])
            dlink = info.get("dlink") or ""
            if not dlink:
                raise BaiduError("云端还没有备份文件，请先上传一次")
            token = self._token()
            if "?" in dlink:
                dlink += "&access_token=" + urllib.parse.quote(token)
            else:
                dlink += "?access_token=" + urllib.parse.quote(token)
            raw = _request(dlink, headers={"User-Agent": UA})
            try:
                parsed = json.loads(raw.decode("utf-8"))
                if parsed.get("errno"):
                    raise BaiduError(parsed.get("show_msg") or "下载失败")
            except (UnicodeDecodeError, ValueError):
                pass
            self.cfg["lastRemoteMd5"] = str(info.get("md5") or self.cfg.get("lastRemoteMd5", ""))
            self.cfg["lastRemoteMtime"] = int(info.get("mtime") or 0)
            self.cfg["lastUpload"] = int(time.time())
            self.save()
            self.last_error = ""
            return {"ok": True, "text": raw.decode("utf-8"),
                    "path": path, "md5": info.get("md5", ""),
                    "mtime": info.get("mtime", 0)}

    # ---------- 状态 / 自动备份 ----------
    def status(self, check_remote=True):
        with self.lock:
            cfg = self.cfg
            result = {
                "configured": bool(cfg.get("appKey") and cfg.get("secretKey")),
                "authorized": self.authorized(),
                "appName": cfg.get("appName", ""),
                "redirectUri": cfg.get("redirectUri", DEFAULT_REDIRECT),
                "auto": bool(cfg.get("auto")),
                "uid": cfg.get("uid", ""),
                "expiresAt": int(cfg.get("expiresAt") or 0),
                "lastUpload": int(cfg.get("lastUpload") or 0),
                "lastError": self.last_error,
                "remotePath": remote_path(cfg["appName"]) if cfg.get("appName") else "",
                "encrypted": sys.platform == "win32",
            }
            if check_remote and result["authorized"]:
                try:
                    remote = self._remote_meta() or {}
                    result["remote"] = {
                        "fs_id": remote.get("fs_id", 0),
                        "size": remote.get("size", 0),
                        "mtime": int(remote.get("mtime") or 0),
                        "md5": remote.get("md5", ""),
                    }
                    known = str(cfg.get("lastRemoteMd5") or "")
                    result["conflict"] = bool(
                        known and remote.get("md5") and remote["md5"] != known and
                        int(remote.get("mtime") or 0) > result["lastUpload"] + 2)
                except Exception as exc:  # noqa: BLE001
                    result["remote"] = None
                    result["conflict"] = False
                    result["lastError"] = str(exc)
            else:
                result["remote"] = None
                result["conflict"] = False
            return result

    def schedule_auto(self, delay=20.0):
        """保存后延迟上传：合并连续写入，避免每题一次请求消耗接口配额。"""
        if not (self.cfg.get("auto") and self.authorized()):
            return False
        with self.lock:
            if self._auto_timer:
                return True
            timer = threading.Timer(delay, self._auto_run)
            timer.daemon = True
            self._auto_timer = timer
            timer.start()
            return True

    def _auto_run(self):
        with self.lock:
            self._auto_timer = None
        try:
            self.upload_backup()
        except Exception as exc:  # noqa: BLE001
            self.last_error = "自动备份失败：" + str(exc)


def app_port_busy(port: int) -> bool:
    import socket
    if not port:
        return False
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.settimeout(0.25)
    try:
        return probe.connect_ex(("127.0.0.1", port)) == 0
    finally:
        probe.close()
