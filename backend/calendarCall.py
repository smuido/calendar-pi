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
CALENDARS_FILE = "calendarCalendars.json"
CALENDARS_REFRESH_FILE = "calendarCalendars.refresh"
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


def writeCalendarsForFrontend(calendars):
  """Write calendar names to CALENDARS_FILE so the frontend can populate its dropdown."""

  calendarNames = []
  seenNames = set()

  for calendar in calendars:
    name = calendar.get("summary", "(Unnamed calendar)")
    if name in seenNames:
      continue
    seenNames.add(name)
    calendarNames.append(name)

  with open(CALENDARS_FILE, "w", encoding="utf-8") as calendars_file:
    json.dump(calendarNames, calendars_file)

  return calendarNames


def readCalendarRefreshToken():
  """Return the latest refresh token written by the frontend, if any."""

  if not os.path.exists(CALENDARS_REFRESH_FILE):
    return None

  try:
    with open(CALENDARS_REFRESH_FILE, "r", encoding="utf-8") as refresh_file:
      return refresh_file.read().strip() or None
  except OSError:
    return None


def waitForNextScanOrRefresh(scanIntervalSeconds, lastRefreshToken):
  """Sleep until the next scan, or return early when the frontend requests a refresh."""

  elapsedSeconds = 0
  currentToken = lastRefreshToken

  while elapsedSeconds < scanIntervalSeconds:
    time.sleep(1)
    elapsedSeconds += 1

    nextToken = readCalendarRefreshToken()
    if nextToken != currentToken:
      return True, nextToken

  return False, currentToken


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


# Where today's events are written so the frontend can read them.
EVENTS_FILE = "calendarEvents.json"


def eventsForFrontend(rawEvents):
  """Convert raw Google Calendar events into the shape the frontend's daily
  view expects: { title, startHour, startMinute, endHour, endMinute, location },
  keeping only events that start and end on today's local date."""

  today = datetime.datetime.now().date()
  frontendEvents = []

  for event in rawEvents:
    startInfo = event.get("start", {})
    endInfo = event.get("end", {})

    # Skip all-day events (they only have a "date", not a "dateTime").
    if "dateTime" not in startInfo or "dateTime" not in endInfo:
      continue

    start = datetime.datetime.fromisoformat(startInfo["dateTime"]).astimezone()
    end = datetime.datetime.fromisoformat(endInfo["dateTime"]).astimezone()

    if start.date() != today:
      continue

    frontendEvents.append({
        "title": event.get("summary", "(No title)"),
        "startHour": start.hour,
        "startMinute": start.minute,
        "endHour": end.hour,
        "endMinute": end.minute,
        "location": event.get("location", ""),
    })

  return frontendEvents


def writeTodaysEvents(service, calendars):
  """Fetch today's events across all calendars and write them to EVENTS_FILE."""
  todaysEvents = []

  for calendar in calendars:
    rawEvents = fetchEvents(service, calendar["id"], style="fullMonth")
    todaysEvents.extend(eventsForFrontend(rawEvents))

  with open(EVENTS_FILE, "w", encoding="utf-8") as events_file:
    json.dump(todaysEvents, events_file)

  return todaysEvents



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
    lastRefreshToken = readCalendarRefreshToken()

    while True:
      # Load every calendar the account can see and write today's events to
      # EVENTS_FILE so the frontend can pick them up on its next load.
      calendars = fetchCals(service)
      print(f"Refreshing calendar view at {datetime.datetime.now(tz=datetime.timezone.utc).isoformat()}")
      print(f"Found {len(calendars)} calendars")

      calendarNames = writeCalendarsForFrontend(calendars)
      print(f"Wrote {len(calendarNames)} calendar names to {CALENDARS_FILE}")

      todaysEvents = writeTodaysEvents(service, calendars)
      print(f"Wrote {len(todaysEvents)} events for today to {EVENTS_FILE}")

      # Wait the configured number of seconds before scanning again.
      shouldRefresh, lastRefreshToken = waitForNextScanOrRefresh(
          loadScanIntervalSeconds(),
          lastRefreshToken,
      )
      if shouldRefresh:
        print("Frontend requested an immediate calendar refresh")
        continue

  except HttpError as error:
    # Surface API failures instead of crashing silently.
    print(f"An error occurred: {error}")


if __name__ == "__main__":
  main()