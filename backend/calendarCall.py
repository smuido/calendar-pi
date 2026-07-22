import datetime
import json
import os.path
import time
from threading import Lock, Thread

from bottle import Bottle, request, response, run
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/calendar"]
DEFAULT_REFRESH_SECONDS = 3600
SETTINGS_FILE = "calendar_settings.json"


def parseRefreshFrequency(value: str) -> int:
  import re
  match = re.match(r'^(\d+)\s+(minute|hour|day|week)s?$', value.strip(), re.IGNORECASE)

  if not match:
    return DEFAULT_REFRESH_SECONDS

  amount = int(match.group(1))
  unit = match.group(2).lower()

  unit_seconds = {
      "minute": 60,
      "hour": 3600,
      "day": 86400,
      "week": 604800,
  }

  return amount * unit_seconds.get(unit, DEFAULT_REFRESH_SECONDS)


def loadRefreshSeconds() -> int:
  if not os.path.exists(SETTINGS_FILE):
    return DEFAULT_REFRESH_SECONDS

  try:
    with open(SETTINGS_FILE, "r", encoding="utf-8") as settings_file:
      payload = json.load(settings_file)
    return parseRefreshFrequency(payload.get("refreshFrequency", "1 hour"))
  except (json.JSONDecodeError, OSError):
    return DEFAULT_REFRESH_SECONDS


def saveRefreshFrequency(value: str):
  payload = {"refreshFrequency": value}
  with open(SETTINGS_FILE, "w", encoding="utf-8") as settings_file:
    json.dump(payload, settings_file)


def createSettingsServer(sharedState: dict, stateLock: Lock):
  app = Bottle()

  @app.hook("after_request")
  def enableCors():
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"

  def refreshFrequencyOptions():
    return ""

  def getRefreshFrequency():
    with stateLock:
      refresh_seconds = sharedState["refreshSeconds"]

    return {"refreshSeconds": refresh_seconds}

  def setRefreshFrequency():
    body = request.json if isinstance(request.json, dict) else {}
    refresh_frequency = body.get("refreshFrequency")

    if not isinstance(refresh_frequency, str):
      response.status = 400
      return {"error": "refreshFrequency must be a string"}

    refresh_seconds = parseRefreshFrequency(refresh_frequency)
    with stateLock:
      sharedState["refreshSeconds"] = refresh_seconds

    saveRefreshFrequency(refresh_frequency)
    return {"refreshSeconds": refresh_seconds}

  app.route("/api/settings/refresh-frequency", method="OPTIONS", callback=refreshFrequencyOptions)
  app.route("/api/settings/refresh-frequency", method="GET", callback=getRefreshFrequency)
  app.route("/api/settings/refresh-frequency", method="POST", callback=setRefreshFrequency)

  return app


def startSettingsServer(sharedState: dict, stateLock: Lock):
  app = createSettingsServer(sharedState, stateLock)

  server_thread = Thread(
      target=lambda: run(app=app, host="127.0.0.1", port=8787, quiet=True),
      daemon=True,
  )
  server_thread.start()

# Fetches a list of calendars from the user's account.
def fetchCals(service):

  calList = service.calendarList().list().execute()
  return calList.get("items", [])


def secondsUntilHour(now=None):
  if now is None:
    now = datetime.datetime.now(tz=datetime.timezone.utc)

  next_hour = now.replace(minute=0, second=0, microsecond=0) + datetime.timedelta(hours=1)
  return (next_hour - now).total_seconds()

# Fetches the next 10 events on the user's primary calendar.
def fetchEvents(service, calendarId, style: str, maxResults=100):

  now = datetime.datetime.now(tz=datetime.timezone.utc)
  if style == "fullMonth":
    monthStart = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if monthStart.month == 12:
      nextMonth = monthStart.replace(year=monthStart.year + 1, month=1)
    else:
      nextMonth = monthStart.replace(month=monthStart.month + 1)

    timeMin = monthStart.isoformat()
    timeMax = nextMonth.isoformat()

  elif style == "monthFromNow":
    timeMin = now.isoformat()
    timeMax = (now + datetime.timedelta(days=30)).isoformat()

  else:
    raise ValueError(f"Unknown fetch style: {style}")

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
  """Shows basic usage of the Google Calendar API.
  Prints the start and name of the next 10 events on the user's calendar.
  """
  creds = None
  # The file token.json stores the user's access and refresh tokens, and is
  # created automatically when the authorization flow completes for the first
  # time.

  if os.path.exists("token.json"):
    creds = Credentials.from_authorized_user_file("token.json", SCOPES)

  # If there are no (valid) credentials available, let the user log in.
  if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
      creds.refresh(Request())
    else:
      flow = InstalledAppFlow.from_client_secrets_file(
          "credentials.json", SCOPES
      )
      creds = flow.run_local_server(port=0)
    # Save the credentials for the next run
    with open("token.json", "w") as token:
      token.write(creds.to_json())

  try:
    service = build("calendar", "v3", credentials=creds)
    shared_state = {"refreshSeconds": loadRefreshSeconds()}
    state_lock = Lock()

    startSettingsServer(shared_state, state_lock)

    while True:
      with state_lock:
        refresh_seconds = shared_state["refreshSeconds"]

      time.sleep(refresh_seconds)

      print(f"Refreshing calendar view at {datetime.datetime.now(tz=datetime.timezone.utc).isoformat()}")

      calendars = fetchCals(service)
      print(f"Found {len(calendars)} calendars")

      # Prints the start and name of the next 10 events
      for calendar in calendars:
        events = fetchEvents(service, calendar["id"], style="fullMonth")
        for event in events:
          start = event["start"].get("dateTime", event["start"].get("date"))
          print(start, event["summary"])

  except HttpError as error:
    print(f"An error occurred: {error}")


if __name__ == "__main__":
  main()