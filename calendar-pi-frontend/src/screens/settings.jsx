import React, { useEffect, useRef, useState } from 'react';
import './defaultTheme/settings.css';
import Switch from '../components/switch';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

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

function buildTimeZoneOptions(selectedTimeZone) {
	const preferred = normalizeTimeZone(selectedTimeZone);
	const zoneSet = new Set([preferred, 'UTC']);

	if (typeof Intl.supportedValuesOf === 'function') {
		try {
			for (const zoneName of Intl.supportedValuesOf('timeZone')) {
				zoneSet.add(zoneName);
			}
		} catch (_error) {
			// Ignore and fall back to currently known zones.
		}
	}

	return Array.from(zoneSet).sort((a, b) => a.localeCompare(b));
}

const DEFAULT_SETTINGS = {
	theme: 'light',
	wakeUp: true,
	wakeUpTime: '08:00',
	wakeUpMinutes: 10,
	scanIntervalSeconds: 3600,
	calendarStyle: 'wholeMonth',
	calendarMaxEvents: 10,
	firstDayOfWeek: 'Sunday',
	workWeekView: false,
	weatherLocation: 'San Luis Obispo, CA, USA',
	timeZone: DEFAULT_TIME_ZONE,
	TimeFormat: '12h',
	DarkModeTimeFrame: {
		start: '21:00',
		end: '07:00',
	},
	followedCalendars: [],
};

function normalizeSettings(input) {
	const payload = input ?? {};
	const rawTimeFormat = payload?.TimeFormat;
	const rawFirstDayOfWeek = payload?.firstDayOfWeek;
	const normalizedTimeFormat = rawTimeFormat === '24h' || rawTimeFormat === '12h'
		? rawTimeFormat
		: (rawTimeFormat === 'enabled' || rawTimeFormat === true ? '24h' : '12h');
	const normalizedFirstDayOfWeek = normalizeFirstDayOfWeek(rawFirstDayOfWeek);
	const rawWorkWeekView = payload?.workWeekView;
	const normalizedWorkWeekView = Boolean(rawWorkWeekView);
	const normalizedTimeZone = normalizeTimeZone(payload?.timeZone);

	return {
		...DEFAULT_SETTINGS,
		...payload,
		TimeFormat: normalizedTimeFormat,
		firstDayOfWeek: normalizedFirstDayOfWeek,
		workWeekView: normalizedWorkWeekView,
		timeZone: normalizedTimeZone,
		DarkModeTimeFrame: {
			...DEFAULT_SETTINGS.DarkModeTimeFrame,
			...(payload.DarkModeTimeFrame ?? {}),
		},
		followedCalendars: Array.isArray(payload.followedCalendars) ? payload.followedCalendars : [],
	};
}

export default function SettingsScreen({ initialSettings, onSave, onBack }) {
	const [form, setForm] = useState(() => normalizeSettings(initialSettings));
	const timeZoneOptions = buildTimeZoneOptions(form.timeZone);
	const [availableCalendars, setAvailableCalendars] = useState([]);
	const [isCalendarsOpen, setIsCalendarsOpen] = useState(false);
	const [isRefreshingCalendars, setIsRefreshingCalendars] = useState(false);
	const [status, setStatus] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const formRef = useRef(form);
	const calendarsDropdownRef = useRef(null);
	const autosaveTimerRef = useRef(null);
	const saveQueueRef = useRef(Promise.resolve());

	useEffect(() => {
		const normalized = normalizeSettings(initialSettings);
		// Only reset the form if we don't have a pending save in flight.
		// If a save is queued, the user has made changes we must not overwrite.
		if (!autosaveTimerRef.current) {
			formRef.current = normalized;
			setForm(normalized);
		}
	}, [initialSettings]);

	useEffect(() => {
		return () => {
			if (autosaveTimerRef.current) {
				clearTimeout(autosaveTimerRef.current);
				autosaveTimerRef.current = null;
				// If the user navigates away before debounce fires, persist latest edits.
				void onSave(normalizeSettings(formRef.current));
			}
		};
	}, [onSave]);

	useEffect(() => {
		function handleDocumentClick(event) {
			if (calendarsDropdownRef.current && !calendarsDropdownRef.current.contains(event.target)) {
				setIsCalendarsOpen(false);
			}
		}

		document.addEventListener('mousedown', handleDocumentClick);
		return () => document.removeEventListener('mousedown', handleDocumentClick);
	}, []);

	useEffect(() => {
		let cancelled = false;

		if (typeof window.electronAPI?.readCalendars !== 'function') {
			return undefined;
		}

		window.electronAPI.readCalendars()
			.then((calendars) => {
				if (!cancelled && Array.isArray(calendars)) {
					setAvailableCalendars(calendars.filter((calendarName) => typeof calendarName === 'string' && calendarName.trim()));
				}
			})
			.catch((error) => {
				console.error('Failed to load calendar names:', error);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	async function refreshCalendarNames() {
		if (typeof window.electronAPI?.refreshCalendars !== 'function') {
			return;
		}

		setIsRefreshingCalendars(true);
		try {
			await window.electronAPI.refreshCalendars();
			const calendars = await window.electronAPI.readCalendars();
			if (Array.isArray(calendars)) {
				setAvailableCalendars(calendars.filter((calendarName) => typeof calendarName === 'string' && calendarName.trim()));
			}
		} catch (error) {
			console.error('Failed to refresh calendar names:', error);
		} finally {
			setIsRefreshingCalendars(false);
		}
	}

	useEffect(() => {
		void refreshCalendarNames();
	}, []);

	async function persistSettings(nextForm) {
		setIsSaving(true);
		setStatus('Saving settings...');

		try {
			await onSave(nextForm);
			setStatus('Settings saved.');
		} catch (error) {
			setStatus(`Save failed: ${error.message}`);
		} finally {
			setIsSaving(false);
		}
	}

	function queuePersist(nextForm) {
		if (autosaveTimerRef.current) {
			clearTimeout(autosaveTimerRef.current);
		}

		autosaveTimerRef.current = setTimeout(() => {
			autosaveTimerRef.current = null;
			const snapshot = normalizeSettings(nextForm);
			saveQueueRef.current = saveQueueRef.current
				.then(() => persistSettings(snapshot))
				.catch(() => {
					// persistSettings already updates visible status on failure.
				});
		}, 200);
	}

	function updateField(key, value) {
		const nextForm = { ...formRef.current, [key]: value };
		formRef.current = nextForm;
		setForm(nextForm);
		queuePersist(nextForm);
	}

	function updateDarkMode(key, value) {
		const nextForm = {
			...formRef.current,
			DarkModeTimeFrame: {
				...formRef.current.DarkModeTimeFrame,
				[key]: value,
			},
		};
		formRef.current = nextForm;
		setForm(nextForm);
		queuePersist(nextForm);
	}

	function toggleFollowedCalendar(calendarName) {
		const cleanedName = typeof calendarName === 'string' ? calendarName.trim() : '';
		if (!cleanedName) return;

		const current = new Set(formRef.current.followedCalendars);
		if (current.has(cleanedName)) {
			current.delete(cleanedName);
		} else {
			current.add(cleanedName);
		}

		updateField('followedCalendars', Array.from(current));
	}

	async function toggleCalendarsDropdown() {
		const nextOpen = !isCalendarsOpen;
		setIsCalendarsOpen(nextOpen);
		if (nextOpen) {
			await refreshCalendarNames();
		}
	}

	async function handleSubmit(event) {
		event.preventDefault();
		await persistSettings(form);
	}

	async function handleResetToDefaults() {
		const defaultForm = normalizeSettings(DEFAULT_SETTINGS);
		if (autosaveTimerRef.current) {
			clearTimeout(autosaveTimerRef.current);
			autosaveTimerRef.current = null;
		}

		formRef.current = defaultForm;
		setIsCalendarsOpen(false);
		setForm(defaultForm);
		await persistSettings(defaultForm);
		setStatus('Reset to default settings.');
	}

	return (
		<div className="settings-root">
			<header className="settings-header">
				<div>
					<h1>Settings</h1>
					<p>Configure your dashboard and calendar behavior.</p>
				</div>
			</header>

			<form className="settings-form" onSubmit={handleSubmit}>
				<section className="settings-card">
					<h2>Appearance</h2>

					<label>
						Theme
						<select value={form.theme} onChange={(event) => updateField('theme', event.target.value)}>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
						</select>
					</label>

					<label>
						Would you like 24-hour time format?
						<Switch
							isOn={form.TimeFormat === '24h'}
							handleToggle={() => updateField('TimeFormat', form.TimeFormat === '24h' ? '12h' : '24h')}
						/>
					</label>

				<div className="settings-switch-group">
					<span className="settings-switch-label">Work Week view? (Mon–Fri only)</span>
					<Switch
						isOn={Boolean(form.workWeekView)}
						handleToggle={() => updateField('workWeekView', !form.workWeekView)}
					/>
				</div>
				</section>

				<section className="settings-card">
					<h2>Wake Up View</h2>

					<div className="settings-switch-group">
						<span className="settings-switch-label">Enable Wake Up View?</span>
						<Switch
							isOn={Boolean(form.wakeUp)}
							handleToggle={() => updateField('wakeUp', !form.wakeUp)}
						/>
					</div>

					<label>
						Wake Up Time
						<input
							type="time"
							value={form.wakeUpTime}
							onChange={(event) => updateField('wakeUpTime', event.target.value)}
						/>
					</label>

					<label>
						Wake Up Minutes
						<input
							type="number"
							min="0"
							max="180"
							value={form.wakeUpMinutes}
							onChange={(event) => updateField('wakeUpMinutes', Number(event.target.value))}
						/>
					</label>
				</section>

				<section className="settings-card">
					<h2>Calendar Data</h2>

					<label>
						Calendar Style
						<select
							value={form.calendarStyle}
							onChange={(event) => updateField('calendarStyle', event.target.value)}
						>
							<option value="wholeMonth">Whole Month</option>
							<option value="monthFromToday">Month From Today</option>
						</select>
					</label>

					<label>
						Start of Week
						<select
							value={form.firstDayOfWeek}
							onChange={(event) => updateField('firstDayOfWeek', event.target.value)}
						>
							{DAYS_OF_WEEK.map((dayName) => (
								<option key={dayName} value={dayName}>{dayName}</option>
							))}
						</select>
					</label>

					<label>
						Max Events Per Calendar
						<input
							type="number"
							min="1"
							max="500"
							value={form.calendarMaxEvents}
							onChange={(event) => updateField('calendarMaxEvents', Number(event.target.value))}
						/>
					</label>

					<label>
						Scan Interval (Seconds)
						<input
							type="number"
							min="10"
							step="10"
							value={form.scanIntervalSeconds}
							onChange={(event) => updateField('scanIntervalSeconds', Number(event.target.value))}
						/>
					</label>

					<label>
						Followed Calendars
						<div className="settings-dropdown" ref={calendarsDropdownRef}>
							<button
								type="button"
								className="settings-dropdown-button"
								onClick={toggleCalendarsDropdown}
								disabled={isRefreshingCalendars}
							>
								<span>
									{isRefreshingCalendars
										? 'Refreshing calendars...'
										: form.followedCalendars.length > 0
											? `${form.followedCalendars.length} calendar${form.followedCalendars.length === 1 ? '' : 's'} selected`
											: 'Choose calendars'}
								</span>
								<span className={`settings-dropdown-caret ${isCalendarsOpen ? 'is-open' : ''}`}>⌄</span>
							</button>
							{isCalendarsOpen && (
								<div className="settings-dropdown-panel" role="listbox" aria-multiselectable="true">
									{availableCalendars.length > 0 ? (
										availableCalendars.map((calendarName) => {
											const checked = form.followedCalendars.includes(calendarName);
											return (
												<label key={calendarName} className="settings-dropdown-item">
													<input
														type="checkbox"
														checked={checked}
														onChange={() => toggleFollowedCalendar(calendarName)}
													/>
													<span>{calendarName}</span>
												</label>
											);
										})
									) : (
										<div className="settings-dropdown-empty">No calendars loaded yet</div>
									)}
								</div>
							)}
						</div>
						<div className="settings-help-text">
							{isRefreshingCalendars ? 'Loading calendar names from Google Calendar...' : 'Calendar names are loaded from Google Calendar.'}
						</div>
					</label>
				</section>

				<section className="settings-card">
					<h2>Weather and Dark Mode</h2>

					<label>
						Time Zone
						<select
							value={form.timeZone}
							onChange={(event) => updateField('timeZone', event.target.value)}
						>
							{timeZoneOptions.map((zoneName) => (
								<option key={zoneName} value={zoneName}>{zoneName}</option>
							))}
						</select>
					</label>

					<label>
						Weather Location
						<input
							type="text"
							value={form.weatherLocation}
							onChange={(event) => updateField('weatherLocation', event.target.value)}
						/>
					</label>

					<div className="settings-two-col">
						<label>
							Dark Mode Start
							<input
								type="time"
								value={form.DarkModeTimeFrame.start}
								onChange={(event) => updateDarkMode('start', event.target.value)}
							/>
						</label>

						<label>
							Dark Mode End
							<input
								type="time"
								value={form.DarkModeTimeFrame.end}
								onChange={(event) => updateDarkMode('end', event.target.value)}
							/>
						</label>
					</div>
				</section>

				<div className="settings-actions">
					<button
						type="button"
						className="settings-reset"
						onClick={() => { void handleResetToDefaults(); }}
					>
						Reset
					</button>
					<span className="settings-status" aria-live="polite">{status}</span>
				</div>
			</form>
		</div>
	);
}
