"""百度网盘 OAuth 直连单元测试（不访问网络，只测配置与 URL 构造）。"""
import json
import sys
import tempfile
import unittest
import urllib.parse
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP_DIR))

from baidu_cloud import BaiduCloud, auth_url, remote_path, safe_app_name  # noqa: E402


class BaiduCloudTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cloud = BaiduCloud(Path(self.tmp.name))

    def tearDown(self):
        self.tmp.cleanup()

    def test_app_name_and_remote_path(self):
        self.assertEqual(safe_app_name(" SpellLab-测试 "), "SpellLab-测试")
        with self.assertRaises(ValueError):
            safe_app_name("../evil")
        with self.assertRaises(ValueError):
            safe_app_name("a/b")
        self.assertEqual(remote_path("SpellLab"),
                         "/apps/SpellLab/SpellLab/spelllab-backup.json")

    def test_auth_url_contains_oauth_params(self):
        url = auth_url("appkey", "http://127.0.0.1:8791/oauth/callback", "state-1")
        parts = urllib.parse.urlparse(url)
        query = urllib.parse.parse_qs(parts.query)
        self.assertEqual(parts.hostname, "openapi.baidu.com")
        self.assertEqual(query["response_type"], ["code"])
        self.assertEqual(query["client_id"], ["appkey"])
        self.assertEqual(query["scope"], ["basic,netdisk"])
        self.assertEqual(query["state"], ["state-1"])
        self.assertEqual(query["redirect_uri"], ["http://127.0.0.1:8791/oauth/callback"])

    def test_callback_port_matches_redirect_uri(self):
        self.assertEqual(self.cloud.callback_port, 8791)
        self.cloud.configure({"appId": "123", "appKey": "key", "secretKey": "secret",
                              "appName": "SpellLab",
                              "redirectUri": "http://127.0.0.1:8899/oauth/callback"})
        self.assertEqual(self.cloud.callback_port, 8899)
        self.assertEqual(self.cloud.callback_path, "/oauth/callback")

    def test_configure_keeps_secrets_out_of_status(self):
        status = self.cloud.configure({
            "appId": "123", "appKey": "key", "secretKey": "secret",
            "appName": "SpellLab", "redirectUri": "http://127.0.0.1:8791/oauth/callback",
            "auto": True,
        })
        self.assertTrue(status["configured"])
        self.assertFalse(status["authorized"])
        self.assertEqual(status["appName"], "SpellLab")
        self.assertTrue(status["auto"])
        self.assertNotIn("secretKey", status)
        self.assertNotIn("secret", json.dumps(status, ensure_ascii=False))

    def test_blank_secret_reuses_saved_one(self):
        self.cloud.configure({"appId": "123", "appKey": "key", "secretKey": "secret",
                              "appName": "SpellLab"})
        self.cloud.configure({"appId": "123", "appKey": "key", "secretKey": "",
                              "appName": "SpellLab"})
        self.assertEqual(self.cloud.cfg["secretKey"], "secret")

    def test_changing_app_key_clears_old_token(self):
        self.cloud.configure({"appId": "123", "appKey": "key1", "secretKey": "s1",
                              "appName": "SpellLab"})
        self.cloud.cfg["accessToken"] = "old-token"
        self.cloud.cfg["refreshToken"] = "old-refresh"
        self.cloud.configure({"appId": "123", "appKey": "key2", "secretKey": "s2",
                              "appName": "SpellLab"})
        self.assertFalse(self.cloud.authorized())
        self.assertEqual(self.cloud.cfg["accessToken"], "")

    def test_disconnect_removes_local_config(self):
        self.cloud.configure({"appId": "123", "appKey": "key", "secretKey": "secret",
                              "appName": "SpellLab"})
        self.assertTrue(self.cloud.config_path.is_file())
        self.cloud.disconnect()
        self.assertFalse(self.cloud.config_path.is_file())
        self.assertFalse(self.cloud.authorized())


if __name__ == "__main__":
    unittest.main()
