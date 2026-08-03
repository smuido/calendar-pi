import React, { useMemo } from 'react';
import './defaultTheme/weekView.css';

const HOUR_HEIGHT = 56;

function formatHourLabel(hour, timeFormat) {
    if (timeFormat === '24h') {
        return `${String(hour).padStart(2, '0')}:00`;
    }
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
}

function dayKey(dateObj) {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

function extractEventDayKey(eventItem) {
    const source = eventItem.date ?? eventItem.startDate ?? eventItem.start ?? eventItem.startTime;
    if (!source || typeof source !== 'string') return null;
    const datePart = source.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function eventGeometry(startHour, startMinute, endHour, endMinute, wakeUpHour) {
    const top = (startHour - wakeUpHour + startMinute / 60) * HOUR_HEIGHT;
    const bottom = (endHour - wakeUpHour + endMinute / 60) * HOUR_HEIGHT;
    return { top, height: Math.max(bottom - top, 18) };
}

export default function WeekView({ events = [], wakeUpHour = 7, timeFormat = '12h', firstDayOfWeek = 'Sunday', workWeekView = false }) {
    const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysToShow = workWeekView ? 5 : 7;

    const now = new Date();

    // Work week mode always starts on Monday regardless of firstDayOfWeek
    const effectiveFirstDay = workWeekView ? 'Monday' : firstDayOfWeek;
    const startDayIndex = DAYS_OF_WEEK.indexOf(effectiveFirstDay);
    const safeStartDayIndex = startDayIndex >= 0 ? startDayIndex : 0;
    const weekStart = new Date(now);
    const offset = (now.getDay() - safeStartDayIndex + 7) % 7;
    weekStart.setDate(now.getDate() - offset);
    weekStart.setHours(0, 0, 0, 0);

    const weekDays = Array.from({ length: daysToShow }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + index);
        return day;
    });

    const hours = Array.from({ length: 24 - wakeUpHour }, (_, i) => wakeUpHour + i);

    const eventsByDay = useMemo(() => {
        return events.reduce((acc, eventItem) => {
            const key = extractEventDayKey(eventItem);
            if (!key) return acc;
            if (!acc[key]) acc[key] = [];
            acc[key].push(eventItem);
            return acc;
        }, {});
    }, [events]);

    const todayKey = dayKey(now);
    const weekStartLabel = weekDays[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '';
    const weekEndLabel = weekDays[weekDays.length - 1]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '';
    const startMonthName = weekDays[0]?.toLocaleDateString('en-US', { month: 'long' }) ?? '';
    const endMonthName = weekDays[weekDays.length - 1]?.toLocaleDateString('en-US', { month: 'long' }) ?? '';
    const headerMonthName = startMonthName === endMonthName
        ? startMonthName
        : `${startMonthName} - ${endMonthName}`;
    const gridVars = { '--wv-days': daysToShow };

    return (
        <div className="wv-root">
            <div className="wv-header-card">
                <h2 className="wv-header-title">
                    {headerMonthName}
                </h2>
            </div>

            <div className="wv-shell">

                {/* Day header row */}
                <div className="wv-day-header-row" style={gridVars}>
                    <div className="wv-gutter-header-spacer" />
                    {weekDays.map((day) => {
                        const isToday = dayKey(day) === todayKey;
                        return (
                            <div key={day.toISOString()} className={`wv-day-header-cell ${isToday ? 'is-today' : ''}`}>
                                <div className="wv-day-header-name">
                                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                                <div className={`wv-day-date-pill ${isToday ? 'is-today' : ''}`}>
                                    {day.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Scrollable grid body */}
                <div className="wv-body-scroll">
                    <div className="wv-grid" style={gridVars}>

                        {/* Hour gutter */}
                        <div className="wv-hour-gutter">
                            {hours.map((hour, index) => (
                                <div
                                    key={`h-${hour}`}
                                    className={`wv-hour-label ${index === 0 ? 'is-first' : ''}`}
                                    style={{ '--hour-top': `${index * HOUR_HEIGHT - 8}px` }}
                                >
                                    {formatHourLabel(hour, timeFormat)}
                                </div>
                            ))}
                            <div
                                className="wv-hour-label is-last"
                                style={{ '--hour-top': `${hours.length * HOUR_HEIGHT - 8}px` }}
                            >
                                {formatHourLabel(24, timeFormat)}
                            </div>
                            <div style={{ height: `${hours.length * HOUR_HEIGHT}px` }} />
                        </div>

                        {/* Day columns */}
                        {weekDays.map((day) => {
                            const key = dayKey(day);
                            const isToday = key === todayKey;
                            const dayEvents = (eventsByDay[key] ?? []).filter((ev) => ev.startHour >= wakeUpHour);
                            return (
                                <div
                                    key={key}
                                    className={`wv-day-column ${isToday ? 'is-today' : ''}`}
                                    style={{ height: `${hours.length * HOUR_HEIGHT}px` }}
                                >
                                    {/* Hour lines */}
                                    {hours.map((_, index) => (
                                        <div
                                            key={`${key}-line-${index}`}
                                            className="wv-hour-line"
                                            style={{ '--line-top': `${index * HOUR_HEIGHT}px` }}
                                        />
                                    ))}

                                    <div
                                        className="wv-hour-line"
                                        style={{ '--line-top': `${hours.length * HOUR_HEIGHT}px` }}
                                    />

                                    {/* Event blocks */}
                                    {dayEvents.map((ev, idx) => {
                                        const { top, height } = eventGeometry(
                                            ev.startHour,
                                            ev.startMinute ?? 0,
                                            ev.endHour,
                                            ev.endMinute ?? 0,
                                            wakeUpHour
                                        );
                                        return (
                                            <div
                                                key={`${key}-${idx}`}
                                                className="wv-event"
                                                style={{
                                                    '--event-top': `${top}px`,
                                                    '--event-height': `${height}px`,
                                                    '--event-bg': ev.color ?? '#1a73e8',
                                                }}
                                            >
                                                <div className="wv-event-title">
                                                    {ev.title}
                                                </div>
                                                {ev.location && (
                                                    <div className="wv-event-location">
                                                        {ev.location}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
