import React, { useState, useEffect } from 'react';
import GoodMorning from './screens/goodMorning.jsx';
import MonthView from './screens/monthView.jsx';
import SettingsScreen from './screens/settings.jsx';
import WeekView from './screens/weekView.jsx';
const DEFAULT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const HOUR_HEIGHT = 56;
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

const DEFAULT_SETTINGS = {
    theme: 'light',
    calTheme: 'default',
    wakeUp: true,
    wakeUpTime: '08:00',
    wakeUpMinutes: 10,
    scanIntervalSeconds: 3600,
    calendarStyle: 'wholeMonth',
    calendarMaxEvents: 10,
    firstDayOfWeek: 'Sunday',
    workWeekView: false,
    weatherLocation: 'San Luis Obispo, CA, USA',
    TimeFormat: '12h',
    timeZone: DEFAULT_TIME_ZONE,
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

function parseTimeToMinutes(timeStr) {
    if (typeof timeStr !== 'string') return null;
    const [hText, mText] = timeStr.split(':');
    const hours = Number(hText);
    const minutes = Number(mText);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return (hours * 60) + minutes;
}

function isInWakeUpWindow(nowDate, wakeUpTime, wakeUpMinutes) {
    const startMinutes = parseTimeToMinutes(wakeUpTime);
    if (startMinutes == null) return false;

    const duration = Number(wakeUpMinutes);
    if (!Number.isFinite(duration) || duration <= 0) return false;

    const nowMinutes = (nowDate.getHours() * 60) + nowDate.getMinutes();
    const endMinutes = startMinutes + duration;

    if (endMinutes < 1440) {
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }

    return nowMinutes >= startMinutes || nowMinutes < (endMinutes % 1440);
}

function normalizeSettings(input) {
    const loadedSettings = input ?? {};
    const rawTimeFormat = loadedSettings?.TimeFormat;
    const rawFirstDayOfWeek = loadedSettings?.firstDayOfWeek;
    const normalizedTimeFormat = rawTimeFormat === '24h' || rawTimeFormat === '12h'
        ? rawTimeFormat
        : (rawTimeFormat === 'enabled' || rawTimeFormat === true ? '24h' : '12h');
    const normalizedFirstDayOfWeek = normalizeFirstDayOfWeek(rawFirstDayOfWeek);
    const rawWorkWeekView = loadedSettings?.workWeekView;
    const normalizedWorkWeekView = Boolean(rawWorkWeekView);

    return {
        ...DEFAULT_SETTINGS,
        ...loadedSettings,
        TimeFormat: normalizedTimeFormat,
        firstDayOfWeek: normalizedFirstDayOfWeek,
        workWeekView: normalizedWorkWeekView,
        timeZone: normalizeTimeZone(loadedSettings?.timeZone),
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
    const [activeView, setActiveView] = useState('month');
    const [now, setNow] = useState(() => new Date());

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

    useEffect(() => {
        const id = setInterval(() => {
            setNow(new Date());
        }, 30_000);

        return () => clearInterval(id);
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

    const shouldShowWakeUpView = Boolean(settings.wakeUp)
        && activeView === 'month'
        && isInWakeUpWindow(now, settings.wakeUpTime, settings.wakeUpMinutes);


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
            <WeekView
                events={events}
                wakeUpHour={wakeUpHour}
                timeFormat={settings.TimeFormat}
                firstDayOfWeek={settings.firstDayOfWeek}
                workWeekView={Boolean(settings.workWeekView)}
            />
        );
    } else if (shouldShowWakeUpView) {
        content = <GoodMorning wakeUpHour={wakeUpHour} locationName={locationName} events={events} timeFormat={settings.TimeFormat} />;
    } else {
        content = (
            <MonthView
                events={events}
                timeFormat={settings.TimeFormat}
                firstDayOfWeek={settings.firstDayOfWeek}
                calendarStyle={settings.calendarStyle}
            />
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => handleViewChange(activeView === 'week' ? 'month' : 'week')}
                style={{
                    position: 'fixed',
                    top: 16,
                    left: 16,
                    zIndex: 30,
                    border: '1px solid #c8d8ef',
                    background: activeView === 'month' || activeView === 'week' ? '#e8f0fe' : '#ffffff',
                    color: activeView === 'month' || activeView === 'week' ? '#1a73e8' : '#334155',
                    borderRadius: 999,
                    padding: '12px 20px',
                    minWidth: 140,
                    fontSize: 15,
                    fontWeight: 600,
                    boxShadow: '0 10px 24px rgba(32, 56, 89, 0.12)',
                    cursor: 'pointer',
                }}
            >
                Change View
            </button>

            <button
                type="button"
                onClick={() => handleViewChange('settings')}
                style={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    zIndex: 30,
                    border: '1px solid #c8d8ef',
                    background: activeView === 'settings' ? '#e8f0fe' : '#ffffff',
                    color: activeView === 'settings' ? '#1a73e8' : '#334155',
                    borderRadius: 999,
                    padding: '12px 20px',
                    minWidth: 140,
                    fontSize: 15,
                    fontWeight: 600,
                    boxShadow: '0 10px 24px rgba(32, 56, 89, 0.12)',
                    cursor: 'pointer',
                }}
            >
                Settings
            </button>

            {content}
        </div>
    );
}