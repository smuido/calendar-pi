import unittest
import io
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))

from calendarCall import (
    fetchCals,
    DEFAULT_SCAN_INTERVAL_SECONDS,
    loadScanIntervalSeconds,
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


class ScanIntervalTests(unittest.TestCase):
    def test_scan_interval_is_loaded_from_settings_file(self):
        old_cwd = os.getcwd()

        with tempfile.TemporaryDirectory() as tmp_dir:
            try:
                os.chdir(tmp_dir)
                with open("calendarSettings.json", "w", encoding="utf-8") as settings_file:
                    json.dump({"scanIntervalSeconds": 42}, settings_file)

                self.assertEqual(loadScanIntervalSeconds(), 42)
            finally:
                os.chdir(old_cwd)

    def test_scan_interval_defaults_to_one_hour_when_missing(self):
        old_cwd = os.getcwd()

        with tempfile.TemporaryDirectory() as tmp_dir:
            try:
                os.chdir(tmp_dir)
                self.assertEqual(loadScanIntervalSeconds(), DEFAULT_SCAN_INTERVAL_SECONDS)
            finally:
                os.chdir(old_cwd)


if __name__ == "__main__":
    unittest.main()
