import datetime
import json
import os.path
import time

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/calendar"]
SETTINGS_FILE = "calendarSettings.json"
DEFAULT_SCAN_INTERVAL_SECONDS = 3600


def loadScanIntervalSeconds() -> int:
  """Read the scan interval from calendarSettings.json, or fall back to one hour."""
  if not os.path.exists(SETTINGS_FILE):
    return DEFAULT_SCAN_INTERVAL_SECONDS

  try:
    # The settings file stores the polling interval in seconds.
    with open(SETTINGS_FILE, "r", encoding="utf-8") as settings_file:
      payload = json.load(settings_file)

    scan_interval_seconds = int(payload.get("scanIntervalSeconds", DEFAULT_SCAN_INTERVAL_SECONDS))
    return max(1, scan_interval_seconds)
  except (TypeError, ValueError, json.JSONDecodeError, OSError):
    return DEFAULT_SCAN_INTERVAL_SECONDS

# Fetches a list of calendars from the user's account.
def fetchCals(service):
  """Return the calendars available to the authenticated user."""

  # Ask the Google Calendar API for the user's calendar list.
  calList = service.calendarList().list().execute()
  return calList.get("items", [])


# Fetches the next 100 events on the user's primary calendar.
def fetchEvents(service, calendarId, style: str, maxResults=100):
  """Return events for one calendar using the requested date range style."""

  # Use UTC so the query window is consistent regardless of local machine time.
  now = datetime.datetime.now(tz=datetime.timezone.utc)
  if style == "fullMonth":
    # Start at the first moment of the current month and stop at next month.
    monthStart = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if monthStart.month == 12:
      nextMonth = monthStart.replace(year=monthStart.year + 1, month=1)
    else:
      nextMonth = monthStart.replace(month=monthStart.month + 1)

    timeMin = monthStart.isoformat()
    timeMax = nextMonth.isoformat()

  elif style == "monthFromToday":
    # Build a rolling 30-day window starting now.
    timeMin = now.isoformat()
    timeMax = (now + datetime.timedelta(days=30)).isoformat()

  else:
    raise ValueError(f"Unknown fetch style: {style}")

  # Pull the events sorted by start time so the output is predictable.
  events_result = (
      service.events()
      .list(
          calendarId=calendarId,
          timeMin=timeMin,
          timeMax=timeMax,
          maxResults=maxResults,
          singleEvents=True,
          orderBy="startTime",
      )
      .execute()
  )
  return events_result.get("items", [])



def main():
  """Authenticate with Google Calendar and poll all calendars for upcoming events."""
  creds = None

  # Reuse saved OAuth credentials when they exist.
  if os.path.exists("token.json"):
    creds = Credentials.from_authorized_user_file("token.json", SCOPES)

  # If the saved token is missing or expired, refresh it or run the login flow.
  if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
      creds.refresh(Request())
    else:
      flow = InstalledAppFlow.from_client_secrets_file(
          "credentials.json", SCOPES
      )
      creds = flow.run_local_server(port=0)

    # Persist the refreshed credentials so the next run can reuse them.
    with open("token.json", "w") as token:
      token.write(creds.to_json())

  try:
    # Build the API client once and reuse it inside the polling loop.
    service = build("calendar", "v3", credentials=creds)

    while True:
      # Wait the configured number of seconds before scanning again.
      time.sleep(loadScanIntervalSeconds())

      # This is the start of one polling cycle.
      print(f"Refreshing calendar view at {datetime.datetime.now(tz=datetime.timezone.utc).isoformat()}")

      # Load every calendar the account can see.
      calendars = fetchCals(service)
      print(f"Found {len(calendars)} calendars")

      # Fetch and print the events for each calendar returned above.
      for calendar in calendars:
        events = fetchEvents(service, calendar["id"], style="fullMonth")
        for event in events:
          start = event["start"].get("dateTime", event["start"].get("date"))
          print(start, event["summary"])

  except HttpError as error:
    # Surface API failures instead of crashing silently.
    print(f"An error occurred: {error}")


if __name__ == "__main__":
  main()