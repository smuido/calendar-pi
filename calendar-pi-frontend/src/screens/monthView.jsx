import React, { useMemo } from 'react';
import './defaultTheme/monthView.css';

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

function dayKey(dateObj) {
	return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

function extractEventDayKey(eventItem) {
	const source = eventItem.date ?? eventItem.startDate ?? eventItem.start ?? eventItem.startTime;
	if (!source || typeof source !== 'string') return null;
	const datePart = source.slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function formatClock(hour, minute, timeFormat) {
	const safeHour = Number.isInteger(hour) ? hour : 0;
	const safeMinute = Number.isInteger(minute) ? minute : 0;

	if (timeFormat === '24h') {
		return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
	}

	const period = safeHour >= 12 ? 'PM' : 'AM';
	const twelveHour = safeHour % 12 === 0 ? 12 : safeHour % 12;
	return `${twelveHour}:${String(safeMinute).padStart(2, '0')} ${period}`;
}

function getGridStartDate(anchorDate, firstDayOfWeek) {
	const dayIndex = DAYS_OF_WEEK.indexOf(firstDayOfWeek);
	const safeDayIndex = dayIndex >= 0 ? dayIndex : 0;
	const start = new Date(anchorDate);
	const offset = (start.getDay() - safeDayIndex + 7) % 7;
	start.setDate(start.getDate() - offset);
	start.setHours(0, 0, 0, 0);
	return start;
}

function formatMonthYear(dateObj) {
	return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function MonthView({ events = [], timeFormat = '12h', firstDayOfWeek = 'Sunday', calendarStyle = 'wholeMonth' }) {
	const today = new Date();
	const todayKey = dayKey(today);
	const effectiveFirstDay = normalizeFirstDayOfWeek(firstDayOfWeek);

	const monthAnchor = useMemo(() => {
		if (calendarStyle === 'monthFromToday') {
			const date = new Date(today);
			date.setHours(0, 0, 0, 0);
			return date;
		}

		return new Date(today.getFullYear(), today.getMonth(), 1);
	}, [calendarStyle, today]);

	const gridStart = useMemo(
		() => getGridStartDate(monthAnchor, effectiveFirstDay),
		[monthAnchor, effectiveFirstDay]
	);

	const gridLength = calendarStyle === 'monthFromToday' ? 35 : 42;

	const gridDays = useMemo(
		() => Array.from({ length: gridLength }, (_, i) => {
			const date = new Date(gridStart);
			date.setDate(gridStart.getDate() + i);
			return date;
		}),
		[gridStart, gridLength]
	);

	const dayHeaders = useMemo(() => {
		const startIdx = DAYS_OF_WEEK.indexOf(effectiveFirstDay);
		const safeStartIdx = startIdx >= 0 ? startIdx : 0;
		return Array.from({ length: 7 }, (_, i) => DAYS_OF_WEEK[(safeStartIdx + i) % 7]);
	}, [effectiveFirstDay]);

	const eventsByDay = useMemo(() => {
		const byDay = {};
		for (const eventItem of events) {
			const key = extractEventDayKey(eventItem);
			if (!key) continue;
			if (!byDay[key]) byDay[key] = [];
			byDay[key].push(eventItem);
		}

		for (const key of Object.keys(byDay)) {
			byDay[key].sort((a, b) => {
				const aStart = (a.startHour ?? 0) * 60 + (a.startMinute ?? 0);
				const bStart = (b.startHour ?? 0) * 60 + (b.startMinute ?? 0);
				return aStart - bStart;
			});
		}

		return byDay;
	}, [events]);

	const visibleMonthLabel = useMemo(() => {
		if (calendarStyle === 'monthFromToday') {
			const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
			const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
			return `${formatMonthYear(currentMonth)} - ${formatMonthYear(nextMonth)}`;
		}

		return formatMonthYear(new Date(today.getFullYear(), today.getMonth(), 1));
	}, [calendarStyle, today]);

	return (
		<div className="mv-root">
			<div className="mv-header-card">
				<h2 className="mv-header-title">{visibleMonthLabel}</h2>
			</div>

			<div className="mv-shell">
				<div className="mv-weekday-row">
					{dayHeaders.map((dayName) => (
						<div key={dayName} className="mv-weekday-cell">{dayName.slice(0, 3)}</div>
					))}
				</div>

				<div className="mv-grid">
					{gridDays.map((dateObj) => {
						const key = dayKey(dateObj);
						const isToday = key === todayKey;
						const inCurrentMonth = dateObj.getMonth() === today.getMonth();
						const dayEvents = eventsByDay[key] ?? [];
						const maxVisibleEvents = 3;
						const hiddenCount = Math.max(dayEvents.length - maxVisibleEvents, 0);

						return (
							<div key={key} className={`mv-day-cell ${isToday ? 'is-today' : ''} ${inCurrentMonth ? '' : 'is-outside-month'}`}>
								<div className="mv-day-num-wrap">
									<span className={`mv-day-num ${isToday ? 'is-today' : ''}`}>{dateObj.getDate()}</span>
								</div>

								<div className="mv-events">
									{dayEvents.slice(0, maxVisibleEvents).map((eventItem, idx) => (
										<div key={`${key}-event-${idx}`} className="mv-event" style={{ '--mv-event-color': eventItem.color ?? '#1a73e8' }}>
											<span className="mv-event-time">
												{formatClock(eventItem.startHour ?? 0, eventItem.startMinute ?? 0, timeFormat)}
											</span>
											<span className="mv-event-title">{eventItem.title ?? 'Untitled event'}</span>
										</div>
									))}

									{hiddenCount > 0 && (
										<div className="mv-event-more">+{hiddenCount} more</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
