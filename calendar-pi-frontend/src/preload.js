// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	readSettings: () => ipcRenderer.invoke('read-settings'),
	readEvents: () => ipcRenderer.invoke('read-events'),
	readCalendars: () => ipcRenderer.invoke('read-calendars'),
	refreshCalendars: () => ipcRenderer.invoke('refresh-calendars'),
	startLogin: () => ipcRenderer.invoke('start-login'),
	getAuthStatus: () => ipcRenderer.invoke('get-auth-status'),
	deleteToken: () => ipcRenderer.invoke('delete-token'),
	writeSettings: (settingsPayload) => ipcRenderer.invoke('write-settings', settingsPayload),
	onSettingsUpdated: (callback) => {
		const listener = (_event, settingsPayload) => callback(settingsPayload);
		ipcRenderer.on('settings-updated', listener);
		return () => ipcRenderer.removeListener('settings-updated', listener);
	},
});
