# calendar-pi

> ⚠️ **Work in progress** — features and configuration options may change.

A Raspberry Pi desktop calendar dashboard. A Python daemon polls your Google Calendar and writes event data to disk; an Electron + React app reads those files and renders calendar views.

---

## Features

- **Month view** — full month calendar grid with configurable start-of-week
- **Week view** — 7-day or Mon–Fri work-week grid
- **Good Morning view** — daily agenda shown automatically in a configurable wake-up window, with a live weather card (powered by [Open-Meteo](https://open-meteo.com/), no API key required)
- **Settings panel** — all options are autosaved; changes take effect immediately
- **Live settings sync** — the frontend reacts to settings file changes in real time
- **On-demand calendar refresh** — the frontend can trigger an immediate re-fetch from Google Calendar without restarting the daemon

---

## Architecture

Communication between the Python backend and the Electron frontend is entirely **file-based** — no HTTP server, no sockets.

```
calendarCall.py  ──polling──►  calendarEvents.json      (today's events)
                 ──────────►  calendarCalendars.json    (calendar names)

Electron main   ◄──────────►  calendarSettings.json     (all settings)
                ──────────►   calendarCalendars.refresh  (refresh trigger)
```

The backend reads `calendarCalendars.refresh` once per second. When the Electron app writes a new token to that file, the daemon skips its remaining sleep time and re-fetches immediately.

---

## Requirements

- **Python 3.9+**
- **Node.js 18+** and npm
- A Google Cloud project with the **Google Calendar API** enabled and an OAuth 2.0 `credentials.json` file placed in `backend/`

---

## Setup

### 1. Python backend

```bash
pip install -r requirements.txt
```

Place your `credentials.json` (OAuth 2.0 client secret) in `backend/`.

### 2. Frontend

```bash
cd calendar-pi-frontend
npm install
```

---

## Running

Start **both** processes concurrently — the backend daemon and the Electron app.

```bash
# Terminal 1 — backend daemon
cd backend
python calendarCall.py
```

On first run the daemon opens a browser window for Google OAuth2 consent and saves the token to `backend/token.json`. Subsequent runs reuse the saved token.

```bash
# Terminal 2 — frontend
cd calendar-pi-frontend
npm start
```

---

## Configuration

All settings are stored in `backend/calendarSettings.json` and can be edited through the in-app Settings panel.

| Setting | Default | Description |
|---|---|---|
| `theme` | `"light"` | UI theme (`"light"` or `"dark"`) |
| `wakeUp` | `true` | Enable the Good Morning view |
| `wakeUpTime` | `"08:00"` | Time at which the Good Morning view appears |
| `wakeUpMinutes` | `10` | How many minutes the Good Morning view stays visible |
| `scanIntervalSeconds` | `3600` | How often the backend polls Google Calendar (seconds) |
| `calendarStyle` | `"wholeMonth"` | Event fetch window: `"wholeMonth"` or `"monthFromToday"` |
| `calendarMaxEvents` | `10` | Maximum events to display per calendar |
| `firstDayOfWeek` | `"Sunday"` | First column of the week grid |
| `workWeekView` | `false` | Show Mon–Fri only in week view |
| `weatherLocation` | `"San Luis Obispo, CA, USA"` | City name used to fetch weather |
| `timeZone` | `"America/Los_Angeles"` | IANA time zone for event display |
| `TimeFormat` | `"24h"` | Clock format: `"12h"` or `"24h"` |
| `DarkModeTimeFrame` | `{"start":"21:00","end":"07:00"}` | Scheduled dark mode window |
| `followedCalendars` | `[]` | Calendar names to include (empty = all) |

---

## Project Structure

```
calendar-pi/
├── backend/
│   ├── calendarCall.py          # Google Calendar polling daemon
│   ├── calendarCallTest.py      # Unit tests
│   └── calendarSettings.json   # Shared configuration
│
├── calendar-pi-frontend/
│   ├── src/
│   │   ├── main.js              # Electron main process + IPC handlers
│   │   ├── preload.js           # Context bridge (window.electronAPI)
│   │   ├── app.jsx              # Root React component + view routing
│   │   ├── components/
│   │   │   ├── switch.js        # Toggle switch component
│   │   │   └── navbar.jsx       # Navigation bar
│   │   └── screens/
│   │       ├── goodMorning.jsx  # Daily agenda + weather view
│   │       ├── monthView.jsx    # Month calendar grid
│   │       ├── weekView.jsx     # Week calendar grid
│   │       ├── settings.jsx     # Settings panel
│   │       └── defaultTheme/   # CSS for each screen
│   └── package.json
│
└── requirements.txt
```

---

## Running Tests

```bash
cd backend
python -m unittest calendarCallTest
```
