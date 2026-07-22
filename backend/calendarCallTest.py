import unittest
import io
import json
import os
import sys
import tempfile
from threading import Lock

sys.path.insert(0, os.path.dirname(__file__))

from calendarCall import (
    DEFAULT_REFRESH_SECONDS,
    createSettingsServer,
    fetchCals,
    parseRefreshFrequency,
)


class FakeCalendarListCall:
    def execute(self):
        return {"items": [{"id": "primary"}, {"id": "work"}]}


class FakeCalendarListResource:
    def list(self):
        return FakeCalendarListCall()


class FakeService:
    def calendarList(self):
        return FakeCalendarListResource()


class FetchCalTests(unittest.TestCase):
    def test_fetch_cal_returns_calendar_items(self):
        calendars = fetchCals(FakeService())
        self.assertEqual(calendars, [{"id": "primary"}, {"id": "work"}])


def run_wsgi_request(app, method, path, body=None):
    payload = b""
    if body is not None:
        payload = json.dumps(body).encode("utf-8")

    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": path,
        "QUERY_STRING": "",
        "SERVER_NAME": "127.0.0.1",
        "SERVER_PORT": "8787",
        "wsgi.version": (1, 0),
        "wsgi.url_scheme": "http",
        "wsgi.input": io.BytesIO(payload),
        "wsgi.errors": io.StringIO(),
        "wsgi.multithread": False,
        "wsgi.multiprocess": False,
        "wsgi.run_once": False,
        "CONTENT_LENGTH": str(len(payload)),
    }

    if body is not None:
        environ["CONTENT_TYPE"] = "application/json"

    response_info = {}

    def start_response(status, headers, exc_info=None):
        response_info["status"] = status
        response_info["headers"] = dict(headers)

    response_body = b"".join(app(environ, start_response)).decode("utf-8")
    return response_info["status"], response_info["headers"], response_body


class RefreshSettingsTests(unittest.TestCase):
    def test_parse_refresh_frequency_accepts_dynamic_values(self):
        self.assertEqual(parseRefreshFrequency("30 minutes"), 1800)
        self.assertEqual(parseRefreshFrequency("1 hour"), 3600)
        self.assertEqual(parseRefreshFrequency("6 hours"), 21600)
        self.assertEqual(parseRefreshFrequency("1 day"), 86400)
        self.assertEqual(parseRefreshFrequency("7 days"), 604800)
        self.assertEqual(parseRefreshFrequency("1 week"), 604800)
        self.assertEqual(parseRefreshFrequency("2 weeks"), 1209600)
        self.assertEqual(parseRefreshFrequency("15 minutes"), 900)
        self.assertEqual(parseRefreshFrequency("unknown"), DEFAULT_REFRESH_SECONDS)
        self.assertEqual(parseRefreshFrequency(""), DEFAULT_REFRESH_SECONDS)

    def test_settings_api_updates_shared_timer_and_persists_setting(self):
        old_cwd = os.getcwd()

        with tempfile.TemporaryDirectory() as tmp_dir:
            try:
                os.chdir(tmp_dir)
                shared_state = {"refreshSeconds": DEFAULT_REFRESH_SECONDS}
                app = createSettingsServer(shared_state, Lock())

                status, _, body = run_wsgi_request(
                    app,
                    "POST",
                    "/api/settings/refresh-frequency",
                    {"refreshFrequency": "30 minutes"},
                )

                self.assertTrue(status.startswith("200"))
                self.assertEqual(shared_state["refreshSeconds"], 1800)
                self.assertTrue(os.path.exists("calendar_settings.json"))
                self.assertEqual(json.loads(body)["refreshSeconds"], 1800)

                get_status, _, get_body = run_wsgi_request(
                    app,
                    "GET",
                    "/api/settings/refresh-frequency",
                )
                self.assertTrue(get_status.startswith("200"))
                self.assertEqual(json.loads(get_body)["refreshSeconds"], 1800)
            finally:
                os.chdir(old_cwd)

    def test_settings_api_rejects_invalid_payload(self):
        shared_state = {"refreshSeconds": DEFAULT_REFRESH_SECONDS}
        app = createSettingsServer(shared_state, Lock())

        status, _, body = run_wsgi_request(
            app,
            "POST",
            "/api/settings/refresh-frequency",
            {},
        )

        self.assertTrue(status.startswith("400"))
        self.assertEqual(json.loads(body)["error"], "refreshFrequency must be a string")


if __name__ == "__main__":
    unittest.main()
