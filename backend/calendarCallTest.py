import unittest

from backend.calendarCall import fetchCals


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


if __name__ == "__main__":
    unittest.main()
