const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const SETTINGS_PATH = path.join(__dirname, '../../../backend/calendarSettings.json');
const CALENDARS_PATH = path.join(__dirname, '../../../backend/calendarCalendars.json');
const CALENDARS_REFRESH_PATH = path.join(__dirname, '../../../backend/calendarCalendars.refresh');
const TOKEN_PATH = path.join(__dirname, '../../../backend/token.json');
const BACKEND_DIR = path.join(__dirname, '../../../backend');
const PYTHON_SCRIPT = path.join(BACKEND_DIR, 'calendarCall.py');
const VENV_PYTHON_PATH = path.join(__dirname, '../../../.venv/Scripts/python.exe');
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let backendProcess = null;

function normalizeFirstDayOfWeek(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) {
    return DAYS_OF_WEEK[value];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const exactMatch = DAYS_OF_WEEK.find((day) => day.toLowerCase() === trimmed.toLowerCase());
    if (exactMatch) return exactMatch;

    const abbreviations = {
      sun: 'Sunday',
      mon: 'Monday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      thu: 'Thursday',
      fri: 'Friday',
      sat: 'Saturday',
    };
    const short = trimmed.slice(0, 3).toLowerCase();
    if (abbreviations[short]) return abbreviations[short];
  }

  return 'Sunday';
}

function normalizeTimeZone(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return DEFAULT_TIME_ZONE;

  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch (_error) {
    return DEFAULT_TIME_ZONE;
  }
}

function readSettingsFromDisk() {
  const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  return JSON.parse(data);
}

function readCalendarsFromDisk() {
  const data = fs.readFileSync(CALENDARS_PATH, 'utf-8');
  return JSON.parse(data);
}

function bumpCalendarsRefreshToken() {
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(CALENDARS_REFRESH_PATH, token, 'utf-8');
  return token;
}

function startBackendPoller() {
  if (backendProcess) {
    return;
  }

  const pythonCommand = fs.existsSync(VENV_PYTHON_PATH) ? VENV_PYTHON_PATH : 'python';
  backendProcess = spawn(pythonCommand, [PYTHON_SCRIPT], {
    cwd: BACKEND_DIR,
    stdio: 'pipe',
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (chunk) => {
    console.log(`[calendarCall] ${String(chunk).trim()}`);
  });

  backendProcess.stderr.on('data', (chunk) => {
    console.error(`[calendarCall] ${String(chunk).trim()}`);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`[calendarCall] exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    backendProcess = null;
  });

  backendProcess.on('error', (error) => {
    console.error('[calendarCall] failed to start:', error);
    backendProcess = null;
  });
}

function stopBackendPoller() {
  if (!backendProcess) {
    return;
  }

  const processToStop = backendProcess;
  backendProcess = null;

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(processToStop.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.on('error', (error) => {
      console.error('[calendarCall] failed to stop with taskkill:', error);
    });
    return;
  }

  processToStop.kill('SIGTERM');
}

function restartBackendPoller() {
  stopBackendPoller();
  startBackendPoller();
}

function broadcastSettingsUpdate(settings) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('settings-updated', settings);
    }
  }
}

function startSettingsWatcher() {
  fs.watchFile(SETTINGS_PATH, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs) return;

    try {
      const latestSettings = readSettingsFromDisk();
      broadcastSettingsUpdate(latestSettings);
    } catch (err) {
      console.error('Failed to broadcast updated settings:', err);
    }
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  if (fs.existsSync(TOKEN_PATH)) {
    startBackendPoller();
  }
  startSettingsWatcher();
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// IPC handlers for reading backend configuration files
ipcMain.handle('read-settings', async () => {
  try {
    return readSettingsFromDisk();
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { wakeUpTime: '08:00', weatherLocation: 'San Luis Obispo, CA, USA' };
    }
    throw new Error(`Failed to read settings: ${err.message}`);
  }
});

ipcMain.handle('read-events', async () => {
  try {
    const backendPath = path.join(__dirname, '../../../backend/calendarEvents.json');
    const data = fs.readFileSync(backendPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to read events: ${err.message}`);
  }
});

ipcMain.handle('read-calendars', async () => {
  try {
    const calendars = readCalendarsFromDisk();
    return Array.isArray(calendars) ? calendars : [];
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to read calendars: ${err.message}`);
  }
});

ipcMain.handle('refresh-calendars', async () => {
  try {
    return { ok: true, token: bumpCalendarsRefreshToken() };
  } catch (err) {
    throw new Error(`Failed to request calendar refresh: ${err.message}`);
  }
});

ipcMain.handle('start-login', async () => {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      restartBackendPoller();
    }

    return { ok: true, started: !fs.existsSync(TOKEN_PATH) };
  } catch (err) {
    throw new Error(`Failed to start login flow: ${err.message}`);
  }
});

ipcMain.handle('get-auth-status', async () => {
  try {
    return { loggedIn: fs.existsSync(TOKEN_PATH) };
  } catch (err) {
    throw new Error(`Failed to read auth status: ${err.message}`);
  }
});

ipcMain.handle('delete-token', async () => {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
      return { ok: true, deleted: true };
    }

    return { ok: true, deleted: false };
  } catch (err) {
    throw new Error(`Failed to delete token: ${err.message}`);
  }
});

ipcMain.handle('write-settings', async (_, settingsPayload) => {
  try {
    const rawTimeFormat = settingsPayload?.TimeFormat;
    const rawFirstDayOfWeek = settingsPayload?.firstDayOfWeek;
    const rawWorkWeekView = settingsPayload?.workWeekView;
    const rawTimeZone = settingsPayload?.timeZone;
    const normalizedTimeFormat = rawTimeFormat === '24h' || rawTimeFormat === '12h'
      ? rawTimeFormat
      : (rawTimeFormat === 'enabled' || rawTimeFormat === true ? '24h' : '12h');
    const normalizedFirstDayOfWeek = normalizeFirstDayOfWeek(rawFirstDayOfWeek);
    const normalizedWorkWeekView = Boolean(rawWorkWeekView);
    const normalizedTimeZone = normalizeTimeZone(rawTimeZone);
    const normalizedFollowedCalendars = Array.isArray(settingsPayload?.followedCalendars)
      ? settingsPayload.followedCalendars
          .map((value) => typeof value === 'string' ? value.trim() : '')
          .filter(Boolean)
      : [];

    const normalizedSettings = {
      theme: settingsPayload?.theme ?? 'light',
      calTheme: settingsPayload?.calTheme ?? 'default',
      wakeUp: Boolean(settingsPayload?.wakeUp),
      wakeUpTime: settingsPayload?.wakeUpTime ?? '08:00',
      wakeUpMinutes: Number(settingsPayload?.wakeUpMinutes ?? 10),
      scanIntervalSeconds: Number(settingsPayload?.scanIntervalSeconds ?? 3600),
      calendarStyle: settingsPayload?.calendarStyle ?? 'wholeMonth',
      calendarMaxEvents: Number(settingsPayload?.calendarMaxEvents ?? 10),
      firstDayOfWeek: normalizedFirstDayOfWeek,
      workWeekView: normalizedWorkWeekView,
      weatherLocation: settingsPayload?.weatherLocation ?? 'San Luis Obispo, CA, USA',
      timeZone: normalizedTimeZone,
      TimeFormat: normalizedTimeFormat,
      DarkModeTimeFrame: {
        start: settingsPayload?.DarkModeTimeFrame?.start ?? '21:00',
        end: settingsPayload?.DarkModeTimeFrame?.end ?? '07:00',
      },
      followedCalendars: normalizedFollowedCalendars,
    };

    fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(normalizedSettings, null, 4)}\n`, 'utf-8');
    bumpCalendarsRefreshToken();
    broadcastSettingsUpdate(normalizedSettings);
    return { ok: true };
  } catch (err) {
    throw new Error(`Failed to write settings: ${err.message}`);
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  fs.unwatchFile(SETTINGS_PATH);
  stopBackendPoller();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendPoller();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
