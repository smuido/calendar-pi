import React, { useState, useEffect } from 'react';
import GoodMorning from './screens/goodMorning.jsx';
import SettingsScreen from './screens/settings.jsx';
import Navbar from './components/navbar.jsx';

const DEFAULT_SETTINGS = {
    theme: 'light',
    calTheme: 'default',
    wakeUp: true,
    wakeUpTime: '08:00',
    wakeUpMinutes: 10,
    scanIntervalSeconds: 3600,
    calendarStyle: 'wholeMonth',
    calendarMaxEvents: 10,
    weatherLocation: 'San Luis Obispo, CA, USA',
    TimeFormat: '12h',
    DarkModeTimeFrame: {
        start: '21:00',
        end: '07:00',
    },
    followedCalendars: [],
};

// Parse "HH:MM" into a 0-23 integer hour, falling back to 7 if anything is invalid.
function parseWakeUpHour(timeStr) {
    if (typeof timeStr !== 'string') return 7;
    const hour = parseInt(timeStr.split(':')[0], 10);
    return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 7;
}

function normalizeSettings(input) {
    const loadedSettings = input ?? {};
    return {
        ...DEFAULT_SETTINGS,
        ...loadedSettings,
        DarkModeTimeFrame: {
            ...DEFAULT_SETTINGS.DarkModeTimeFrame,
            ...(loadedSettings?.DarkModeTimeFrame ?? {}),
        },
        followedCalendars: Array.isArray(loadedSettings?.followedCalendars)
            ? loadedSettings.followedCalendars
            : [],
    };
}

export default function App() {
    const [wakeUpHour, setWakeUpHour] = useState(7);
    const [locationName, setLocationName] = useState(DEFAULT_SETTINGS.weatherLocation);
    const [events, setEvents] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [activeView, setActiveView] = useState('calendar');

    useEffect(() => {
        // Read wakeUpTime and weather location from calendarSettings.json at startup.
        // The path is relative to the app's working directory (project root).
        window.electronAPI.readSettings()
            .then(loadedSettings => {
                const nextSettings = normalizeSettings(loadedSettings);

                setSettings(nextSettings);
                setWakeUpHour(parseWakeUpHour(nextSettings.wakeUpTime));

                if (typeof nextSettings.weatherLocation === 'string' && nextSettings.weatherLocation.trim()) {
                    setLocationName(nextSettings.weatherLocation.trim());
                }
            })
            .catch(err => {
                // Log the real failure reason instead of silently keeping defaults.
                console.error('Failed to load calendarSettings.json:', err);
            });
    }, []);

    useEffect(() => {
        if (typeof window.electronAPI?.onSettingsUpdated !== 'function') {
            return undefined;
        }

        const unsubscribe = window.electronAPI.onSettingsUpdated((updatedSettings) => {
            const nextSettings = normalizeSettings(updatedSettings);
            setSettings(nextSettings);
            setWakeUpHour(parseWakeUpHour(nextSettings.wakeUpTime));
            setLocationName((nextSettings.weatherLocation || DEFAULT_SETTINGS.weatherLocation).trim());
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    useEffect(() => {
        // Read today's events written by calendarCall.py's polling loop.
        window.electronAPI.readEvents()
            .then(data => {
                if (Array.isArray(data)) setEvents(data);
            })
            .catch(err => {
                console.error('Failed to load calendarEvents.json:', err);
            });
    }, []);

    async function handleSaveSettings(nextSettings) {
        const normalized = normalizeSettings(nextSettings);
        await window.electronAPI.writeSettings(normalized);
        setSettings(normalized);
        setWakeUpHour(parseWakeUpHour(normalized.wakeUpTime));
        setLocationName((normalized.weatherLocation || DEFAULT_SETTINGS.weatherLocation).trim());
    }

    const handleViewChange = (view) => {
        setActiveView(view);
    };

    let content;
    if (activeView === 'settings') {
        content = (
            <SettingsScreen
                initialSettings={settings}
                onSave={handleSaveSettings}
                onBack={() => handleViewChange('month')}
            />
        );
    } else if (activeView === 'week') {
        content = (
            <div style={{ paddingBottom: 56, paddingTop: 20, paddingLeft: 20, paddingRight: 20 }}>
                <h2>Week View</h2>
                <p>Coming soon...</p>
            </div>
        );
    } else {
        content = <GoodMorning wakeUpHour={wakeUpHour} locationName={locationName} events={events} />;
    }

    return (
        <div style={{ position: 'relative' }}>
            {content}
            <Navbar activeView={activeView} onViewChange={handleViewChange} />
        </div>
    );
}