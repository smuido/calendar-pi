# Calendar Pi

![Status: In Development](https://img.shields.io/badge/status-in%20development-orange)
![Project Type: Personal Use](https://img.shields.io/badge/project-personal%20use-blue)

Calendar Pi is an Electron and React desktop calendar dashboard backed by a Python Google Calendar integration. It is intended to run on a Raspberry Pi as an always-on electronic wall calendar, with month, week, settings, weather, and scheduled wake-up views.

> [!WARNING]
> **Calendar Pi is still in active development and is not finished.** Some screens and settings are only partially connected, behavior may change without notice, and setup is not yet polished for general use. This project is built primarily for my own personal use rather than as a supported, production-ready application.

## Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Google Calendar Setup](#google-calendar-setup)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Configuration](#configuration)
- [Testing](#testing)
- [Packaging](#packaging)
- [Raspberry Pi Notes](#raspberry-pi-notes)
- [Known Limitations](#known-limitations)
- [Security and Privacy](#security-and-privacy)
- [Planned Work](#planned-work)
- [License](#license)

## Overview

Calendar Pi has two main parts:

1. A Python backend authenticates with Google Calendar, discovers calendars, polls events, and writes local JSON cache files.
2. An Electron application exposes those local files to a React renderer through a restricted preload API.

The current dashboard includes:

- A month calendar layout.
- A seven-day or Monday-through-Friday week layout.
- A scheduled wake-up view with a daily timeline.
- Current weather for a configured location through Open-Meteo.
- A settings screen that saves configuration to `backend/calendarSettings.json`.

The frontend and backend currently run as separate processes. The Electron application does not automatically start or bundle the Python backend.

## Current Status

| Area | Current behavior | Status |
| --- | --- | --- |
| Google OAuth | Uses a desktop OAuth flow and reuses a local `token.json` file | Working, but intended for local/personal use |
| Calendar discovery | Reads calendars visible to the authenticated Google account | Working |
| Daily event cache | Writes timed events for the current local date to `calendarEvents.json` | Working with limitations |
| Wake-up view | Shows a daily timeline, events, current-time indicator, and weather | Mostly implemented |
| Month view | Month and rolling-from-today layouts are present | UI implemented; event integration incomplete |
| Week view | Seven-day and work-week layouts are present | UI implemented; event integration incomplete |
| Settings | Settings are autosaved to a JSON file | Partially implemented |
| Packaging | Electron Forge packaging is configured | Frontend only; backend is not bundled |
| Raspberry Pi deployment | Raspberry Pi wall-display use is the goal | Manual setup only |

## Features

### Implemented or Partially Implemented

- Google Calendar OAuth authentication.
- Reuse and refresh of saved Google credentials.
- Periodic calendar and event polling.
- Immediate backend refresh requests from the settings screen.
- Month and week calendar interfaces.
- Optional Monday-through-Friday work-week mode.
- Configurable first day of the week.
- 12-hour and 24-hour display formats.
- Scheduled wake-up view with configurable start time and duration.
- Current weather lookup by place name.
- Configurable backend scan interval.
- Calendar selection interface.
- Electron Forge package and installer commands.
- Local backend unit tests for calendar discovery and scan interval loading.

### Not Yet Fully Wired

Several settings are saved correctly but are not yet fully applied by the data pipeline or renderer. These include calendar filtering, maximum event counts, dark mode scheduling, theme selection, configured timezone handling, and some month/week behavior.

### Data Flow

1. `backend/calendarCall.py` starts the Google OAuth flow if no valid token exists.
2. The backend requests the account's calendar list.
3. Calendar names are written to `backend/calendarCalendars.json`.
4. Timed events for the current date are written to `backend/calendarEvents.json`.
5. The Electron main process reads the JSON files and exposes narrow IPC methods through `src/preload.js`.
6. The React renderer reads settings and events when the application starts.
7. Settings changes are written back to `backend/calendarSettings.json` and trigger a backend refresh token update.

## Project Structure

```text
calendar-pi/
|-- backend/
|   |-- calendarCall.py              # Google Calendar polling backend
|   |-- calendarCallTest.py          # Backend unit tests
|   |-- calendarSettings.json        # Local dashboard configuration
|   `-- calendarCalendars.refresh    # Frontend-to-backend refresh signal
|-- calendar-pi-frontend/
|   |-- src/
|   |   |-- app.jsx                  # View selection and application state
|   |   |-- main.js                  # Electron main process and file IPC
|   |   |-- preload.js               # Restricted renderer API
|   |   |-- renderer.js              # React entry point
|   |   |-- components/              # Shared UI components
|   |   `-- screens/                 # Month, week, wake-up, and settings views
|   |-- forge.config.js              # Electron Forge makers and plugins
|   |-- package.json                 # Frontend scripts and dependencies
|   `-- package-lock.json
|-- requirements.txt                 # Python dependencies
`-- .gitignore
```

The following files are created or updated while the application runs:

```text
backend/credentials.json             # Downloaded Google OAuth client credentials
backend/token.json                   # Generated Google access and refresh tokens
backend/calendarCalendars.json       # Cached calendar names
backend/calendarEvents.json          # Cached event data
backend/calendarCalendars.refresh    # Refresh signal changed by Electron
```

## Prerequisites

- A Raspberry Pi or desktop computer with a graphical desktop environment.
- Python 3 and `pip`.
- Node.js and `npm`.
- A Google account with Google Calendar access.
- A Google Cloud project with the Google Calendar API enabled.
- Internet access for Google Calendar and Open-Meteo requests.

The current Electron window is designed around a default size of 1280 by 800 pixels and enforces a minimum size of 1024 by 700 pixels.

## Google Calendar Setup

Calendar Pi uses a local OAuth desktop application flow. Google's official Python Calendar quickstart describes the same general setup:

https://developers.google.com/workspace/calendar/api/quickstart/python

1. Create or select a Google Cloud project.
2. Enable the Google Calendar API.
3. Configure the Google Auth consent screen.
4. Create an OAuth client with the application type set to **Desktop app**.
5. Download the client JSON file.
6. Rename it to `credentials.json`.
7. Place it inside the repository's `backend/` directory:


> IMPORTANT
> The backend currently requests the full `https://www.googleapis.com/auth/calendar` scope, even though the current implementation only reads calendar data. Only authorize an account you are comfortable using with this development project.

The first backend launch opens a local browser-based authorization flow. After authorization, Google tokens are stored in `backend/token.json` and reused on later launches.

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/smuido/calendar-pi.git
cd calendar-pi
```

### 2. Create a Python Virtual Environment

```bash
python3 -m venv .venv
```

Activate it on Linux or macOS:

```bash
source .venv/bin/activate
```

Activate it in Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

### 3. Install Python Dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The current backend directly imports the Google API client libraries. If the full requirements file causes platform-specific issues on a Raspberry Pi, the minimal backend dependencies are:

```bash
python -m pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

### 4. Install Electron Dependencies

```bash
cd calendar-pi-frontend
npm ci
cd ..
```

### 5. Add Google Credentials

Place the downloaded OAuth desktop client file at:

```text
backend/credentials.json
```

Do not commit this file.

## Running the Project

The backend and frontend must currently be started separately.

### Terminal 1: Start the Python Backend

From the repository root:

```bash
source .venv/bin/activate
cd backend
python calendarCall.py
```

Running from `backend/` is important because the Python process currently uses relative paths for `credentials.json`, `token.json`, settings, and cache files.

On the first run:

1. A browser window should open.
2. Sign in to the intended Google account.
3. Approve the requested Calendar permission.
4. Return to the terminal and leave the backend process running.

The backend refreshes according to `scanIntervalSeconds`, which defaults to 3600 seconds. Settings changes can also request an immediate refresh.

### Terminal 2: Start Electron

From the repository root:

```bash
cd calendar-pi-frontend
npm start
```

The Electron application currently opens its developer tools automatically.

## Configuration

Settings are stored in `backend/calendarSettings.json` and can be changed through the settings screen.

| Setting | Default | Current use |
| --- | --- | --- |
| `theme` | `light` | Saved, but theme switching is not fully applied & dark mode hasn't been configured yet |
| `calTheme` | `default` | Reserved for calendar theme selection, which will be implemeted later |
| `wakeUp` | `true` | Enables the scheduled wake-up view |
| `wakeUpTime` | `08:00` | Start of the wake-up window in 24h format |
| `wakeUpMinutes` | `10` | Length of the wake-up window in minutes |
| `scanIntervalSeconds` | `3600` | Backend polling interval |
| `calendarStyle` | `wholeMonth` | Selects whole-month or rolling month layout |
| `calendarMaxEvents` | `10` | Saved, but not yet used by the backend query |
| `firstDayOfWeek` | `Sunday` | Changes month and week layout start day |
| `workWeekView` | `false` | Shows only Monday through Friday in week view |
| `weatherLocation` | `San Luis Obispo, CA, USA` | Location sent to Open-Meteo geocoding |
| `timeZone` | `America/Los_Angeles` | Saved and validated; not fully applied to event conversion |
| `TimeFormat` | `24h` | Controls 12-hour or 24-hour labels |
| `DarkModeTimeFrame` | `21:00` to `07:00` | Saved, but scheduled dark mode is not yet applied |
| `followedCalendars` | `[]` | Saved, but backend filtering is not yet implemented |

Weather temperature is currently requested in Fahrenheit.

## Packaging

Electron Forge scripts are available from `calendar-pi-frontend/`:

```bash
npm run package
npm run make
```

The Forge configuration includes makers for Windows Squirrel packages, a macOS ZIP, Debian packages, and RPM packages.

> CAUTION
> The current package configuration only packages the Electron frontend. It does not bundle the Python backend, Python environment, OAuth credentials, token, cache files, or Raspberry Pi startup configuration. The Electron file paths also assume the development repository layout, so generated packages should not be treated as standalone builds yet.

## Raspberry Pi Notes

Raspberry Pi is the intended deployment target, but deployment is currently manual.

A practical development setup currently requires:

- A Raspberry Pi OS desktop session or another Linux desktop environment.
- Node.js and Electron dependencies that support the Pi's architecture.
- Python and the Google API client dependencies.
- A completed OAuth login with a saved `token.json`.
- Two startup processes: the Python backend and the Electron frontend.
- Network access to Google and Open-Meteo.

The repository does not yet include:

- A `systemd` service for the Python backend.
- Desktop autostart configuration for Electron.
- Kiosk-mode window configuration.
- Screen blanking or power-management setup.
- A one-command Raspberry Pi installer.
- A packaged backend runtime.

## Known Limitations

This list reflects the current code and is expected to change as development continues.

1. **Month and week event integration is incomplete.** The backend currently writes only today's timed events and omits a date field, while the month and week views group events by date.
2. **All-day events are skipped.** Events without Google Calendar `dateTime` values are not added to the frontend cache.
3. **The renderer does not continuously reload event data.** Event JSON is read when the React application starts, so backend refreshes may require restarting or reloading Electron before new event data appears.
4. **Calendar selection is not enforced.** `followedCalendars` is saved, but the backend currently fetches every visible calendar.
5. **Maximum event settings are not enforced.** `calendarMaxEvents` is saved, while the backend currently uses its own query default.
6. **Timezone support is incomplete.** The configured timezone is saved, but backend event conversion currently relies on the host machine's local timezone.
7. **Theme and dark mode controls are incomplete.** Their values are stored but are not fully applied to the renderer.
8. **Frontend and backend lifecycles are separate.** Electron does not start, monitor, or stop the Python backend.
9. **Packaged builds are not standalone.** Backend files and runtime dependencies are not included by Electron Forge.
10. **Developer tools open automatically.** This is useful during development but not appropriate for a finished wall display.
11. **Overlapping, multi-day, and cross-midnight events need more handling.** Current geometry and filtering are intentionally simple.
12. **Error recovery is limited.** API, file, authorization, and network failures are mostly logged rather than surfaced through a complete user-facing flow.

## Security and Privacy

- Never commit `credentials.json` or `token.json`.
- Both files are ignored by the current `.gitignore`.
- OAuth tokens are stored locally as plain JSON, so protect the device and user account running Calendar Pi.
- Runtime cache files can contain calendar names, event titles, locations, and schedule information.
- `calendarCalendars.json`, `calendarEvents.json`, and `calendarCalendars.refresh` are not all currently excluded from version control. Review `git status` before committing and consider adding local calendar cache files to `.gitignore`.
- The configured weather location is sent to Open-Meteo's geocoding and forecast APIs.
- The current Calendar OAuth scope grants broader access than a read-only scope.
