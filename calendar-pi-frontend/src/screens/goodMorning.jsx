import React, { useState, useEffect } from 'react';
import './defaultTheme/goodMorning.css';

// Height in pixels of each one-hour row in the grid.
const HOUR_HEIGHT = 60;

// Format a 0-23 hour number according to selected format.
function formatHourLabel(hour, timeFormat) {
    if (timeFormat === '24h') {
        return `${String(hour).padStart(2, '0')}:00`;
    }

    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
}

// Return the CSS top-offset (px) and height (px) for an event block,
// relative to the grid's first visible row (wakeUpHour).
function eventGeometry(startHour, startMinute, endHour, endMinute, wakeUpHour) {
    const top    = (startHour - wakeUpHour + startMinute / 60) * HOUR_HEIGHT;
    const bottom = (endHour   - wakeUpHour + endMinute   / 60) * HOUR_HEIGHT;
    return { top, height: Math.max(bottom - top, 20) };
}

function getWeatherSymbol(weatherCode) {
    if (weatherCode === 0) return '☀';
    if (weatherCode < 4 && weatherCode > 0) return '☁';
    if ([45, 48].includes(weatherCode)) return '〰';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(weatherCode)) return '☂';
    if ([66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) return '❄';
    if ([95, 96, 99].includes(weatherCode)) return '⚡';
    return '○';
}

function getWeatherLabel(weatherCode) {
    if (weatherCode === 0) return 'Sunny';
    if ([1, 2, 3].includes(weatherCode)) return 'Cloudy';
    if ([45, 48].includes(weatherCode)) return 'Foggy';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(weatherCode)) return 'Rainy';
    if ([66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'Snowy';
    if ([95, 96, 99].includes(weatherCode)) return 'Thunderstorm';
    return 'Unknown';
}

// wakeUpHour: 0-23 integer parsed from calendarSettings.json "wakeUpTime".
// Defaults to 7 (7 AM) if not provided.
// locationName: city name string parsed from calendarSettings.json
// "weatherLocation", geocoded to coordinates and used to fetch local weather.
export default function GoodMorning({ events = [], wakeUpHour = 7, locationName, timeFormat = '12h' }) {
    const now = new Date();
    const [currentMinute, setCurrentMinute] = useState(
        now.getHours() * 60 + now.getMinutes()
    );
    const [weather, setWeather] = useState(null);

    // Tick the current-time indicator every minute.
    useEffect(() => {
        const tick = () => {
            const d = new Date();
            setCurrentMinute(d.getHours() * 60 + d.getMinutes());
        };
        const id = setInterval(tick, 60_000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        // Resolve the configured city name to coordinates, then fetch current
        // weather for that location. Re-runs whenever the location name changes.
        if (!locationName) return;

        let cancelled = false;

        fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1`
        )
            .then((r) => {
                if (!r.ok) throw new Error(`Geocoding request failed: ${r.status}`);
                return r.json();
            })
            .then((geo) => {
                const match = geo?.results?.[0];
                if (!match) throw new Error(`No geocoding match for "${locationName}"`);

                return fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${match.latitude}&longitude=${match.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
                );
            })
            .then((r) => {
                if (!r.ok) throw new Error(`Forecast request failed: ${r.status}`);
                return r.json();
            })
            .then((data) => {
                if (!cancelled && data && data.current) {
                    setWeather(data.current);
                }
            })
            .catch((err) => {
                // Log the real failure reason instead of silently showing "Unknown".
                console.error('Weather fetch failed:', err);
                if (!cancelled) setWeather(null);
            });

        return () => {
            cancelled = true;
        };
    }, [locationName]);

    // Top position of the current-time indicator, offset from the first visible row.
    const currentTimeTop = (currentMinute / 60 - wakeUpHour) * HOUR_HEIGHT;

    const dayLabel = now.toLocaleDateString('en-US', {
        weekday: 'long',
        month:   'long',
        day:     'numeric',
    });

    const greeting = now.getHours() < 12 ? 'Good Morning' : 'Good Afternoon';

    // Visible hours: wakeUpHour through 23, plus an explicit midnight end label.
    const hours = Array.from({ length: 24 - wakeUpHour }, (_, i) => wakeUpHour + i);

    return (
        <div className="dc-root">
            <div className="dc-weather-card" aria-label="Current weather">
                <div className="dc-weather-symbol">{getWeatherSymbol(weather?.weather_code)}</div>
                <div className="dc-weather-meta">
                    <div className="dc-weather-label">{getWeatherLabel(weather?.weather_code)}</div>
                    <div className="dc-weather-temp">
                        {weather?.temperature_2m != null ? `${Math.round(weather.temperature_2m)}°F` : '--'}
                    </div>
                </div>
            </div>

            <div className="dc-content">
                <div className="dc-greeting-wrap">
                    <h1 className="dc-greeting">{greeting}</h1>
                    <p className="dc-message">Ready to take on the day?</p>
                </div>

                <div className="dc-calendar-shell">
                    <div className="dc-header">
                        <span className="dc-header-date">{dayLabel}</span>
                    </div>

                    {/* ── Body: time gutter + day column ──────────────────── */}
                    <div className="dc-body">
                        {/* Left gutter: hour labels */}
                        <div className="dc-gutter">
                            {hours.map((h, idx) => (
                                <div key={h} className="dc-gutter-cell">
                                    <span
                                        className={`dc-hour-label ${idx === 0 ? 'is-first' : ''}`}
                                    >
                                        {formatHourLabel(h, timeFormat)}
                                    </span>
                                </div>
                            ))}
                            <div className="dc-gutter-end-label">
                                <span className="dc-hour-label is-last">
                                    {formatHourLabel(24, timeFormat)}
                                </span>
                            </div>
                        </div>

                        {/* Day column */}
                        <div className="dc-column" style={{ height: hours.length * HOUR_HEIGHT }}>
                            {/* Hour lines — darker, anchored exactly at the top of each hour */}
                            {hours.map((h, idx) => (
                                idx !== 0 && (
                                    <div
                                        key={`hour-${h}`}
                                        className="dc-hour-line"
                                        style={{ top: idx * HOUR_HEIGHT }}
                                    />
                                )
                            ))}

                            <div
                                className="dc-hour-line"
                                style={{ top: hours.length * HOUR_HEIGHT }}
                            />

                            {/* Half-hour lines — lighter, anchored at the midpoint of each hour */}
                            {hours.map((h, idx) => (
                                <div
                                    key={`half-${h}`}
                                    className="dc-half-hour-line"
                                    style={{ top: idx * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                                />
                            ))}

                            {/* Current-time indicator — only render if it falls within the visible range */}
                            {currentMinute >= wakeUpHour * 60 && (
                                <div
                                    className="dc-now-line"
                                    style={{ top: currentTimeTop }}
                                >
                                    <div className="dc-now-dot" />
                                    <div className="dc-now-bar" />
                                </div>
                            )}

                            {/* Event blocks — skip events that start before wakeUpHour */}
                            {events
                                .filter(ev => ev.startHour >= wakeUpHour)
                                .map((ev, idx) => {
                                    const { top, height } = eventGeometry(
                                        ev.startHour, ev.startMinute ?? 0,
                                        ev.endHour,   ev.endMinute   ?? 0,
                                        wakeUpHour
                                    );
                                    return (
                                        <div
                                            key={idx}
                                            className="dc-event"
                                            style={{
                                                top,
                                                height,
                                                backgroundColor: ev.color ?? '#1a73e8',
                                            }}
                                        >
                                            <span className="dc-event-title">{ev.title}</span>
                                            {ev.location && (
                                                <span className="dc-event-location">{ev.location}</span>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}