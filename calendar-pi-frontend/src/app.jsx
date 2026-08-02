import React, { useState, useEffect } from 'react';
import GoodMorning from './screens/goodMorning.jsx';

// Parse "HH:MM" into a 0-23 integer hour, falling back to 8 if anything is invalid.
function parseWakeUpHour(timeStr) {
    if (typeof timeStr !== 'string') return 8;
    const hour = parseInt(timeStr.split(':')[0], 10);
    return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 8;
}

// Default location used if calendarSettings.json is missing or invalid.
const DEFAULT_LOCATION_NAME = 'San Luis Obispo, CA, USA';

export default function App() {
    const [wakeUpHour, setWakeUpHour] = useState(8);
    const [locationName, setLocationName] = useState(DEFAULT_LOCATION_NAME);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        // Read wakeUpTime and weather location from calendarSettings.json at startup.
        // The path is relative to the app's working directory (project root).
        window.electronAPI.readSettings()
            .then(settings => {
                setWakeUpHour(parseWakeUpHour(settings.wakeUpTime));

                if (typeof settings.weatherLocation === 'string' && settings.weatherLocation.trim()) {
                    setLocationName(settings.weatherLocation.trim());
                }
            })
            .catch(err => {
                // Log the real failure reason instead of silently keeping defaults.
                console.error('Failed to load calendarSettings.json:', err);
            });
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

    return <GoodMorning wakeUpHour={wakeUpHour} locationName={locationName} events={events} />;
}