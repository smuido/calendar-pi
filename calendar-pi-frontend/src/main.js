const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const SETTINGS_PATH = path.join(__dirname, '../../../backend/calendarSettings.json');

function readSettingsFromDisk() {
  const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  return JSON.parse(data);
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

ipcMain.handle('write-settings', async (_, settingsPayload) => {
  try {
    const normalizedSettings = {
      theme: settingsPayload?.theme ?? 'light',
      calTheme: settingsPayload?.calTheme ?? 'default',
      wakeUp: Boolean(settingsPayload?.wakeUp),
      wakeUpTime: settingsPayload?.wakeUpTime ?? '08:00',
      wakeUpMinutes: Number(settingsPayload?.wakeUpMinutes ?? 10),
      scanIntervalSeconds: Number(settingsPayload?.scanIntervalSeconds ?? 3600),
      calendarStyle: settingsPayload?.calendarStyle ?? 'wholeMonth',
      calendarMaxEvents: Number(settingsPayload?.calendarMaxEvents ?? 10),
      weatherLocation: settingsPayload?.weatherLocation ?? 'San Luis Obispo, CA, USA',
      TimeFormat: settingsPayload?.TimeFormat ?? '12h',
      DarkModeTimeFrame: {
        start: settingsPayload?.DarkModeTimeFrame?.start ?? '21:00',
        end: settingsPayload?.DarkModeTimeFrame?.end ?? '07:00',
      },
      followedCalendars: Array.isArray(settingsPayload?.followedCalendars)
        ? settingsPayload.followedCalendars
        : [],
    };

    fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(normalizedSettings, null, 4)}\n`, 'utf-8');
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
