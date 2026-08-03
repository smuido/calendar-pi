import React, { useEffect, useMemo, useState } from 'react';
import './settings.css';
import Switch from '../components/switch';

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

function normalizeSettings(input) {
	const payload = input ?? {};
	return {
		...DEFAULT_SETTINGS,
		...payload,
		DarkModeTimeFrame: {
			...DEFAULT_SETTINGS.DarkModeTimeFrame,
			...(payload.DarkModeTimeFrame ?? {}),
		},
		followedCalendars: Array.isArray(payload.followedCalendars) ? payload.followedCalendars : [],
	};
}

export default function SettingsScreen({ initialSettings, onSave, onBack }) {
	const [form, setForm] = useState(() => normalizeSettings(initialSettings));
	const [status, setStatus] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setForm(normalizeSettings(initialSettings));
	}, [initialSettings]);

	const calendarsMultiline = useMemo(
		() => form.followedCalendars.join('\n'),
		[form.followedCalendars]
	);

	function updateField(key, value) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function updateDarkMode(key, value) {
		setForm((prev) => ({
			...prev,
			DarkModeTimeFrame: {
				...prev.DarkModeTimeFrame,
				[key]: value,
			},
		}));
	}

	async function handleSubmit(event) {
		event.preventDefault();
		setIsSaving(true);
		setStatus('Saving settings...');

		try {
			await onSave(form);
			setStatus('Settings saved.');
		} catch (error) {
			setStatus(`Save failed: ${error.message}`);
		} finally {
			setIsSaving(false);
		}
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
						Calendar Theme
						<input
							type="text"
							value={form.calTheme}
							onChange={(event) => updateField('calTheme', event.target.value)}
						/>
					</label>

					<label>
						Time Format
						<select value={form.TimeFormat} onChange={(event) => updateField('TimeFormat', event.target.value)}>
							<option value="12h">12h</option>
							<option value="24h">24h</option>
						</select>
					</label>
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
						Followed Calendars (one ID per line)
						<textarea
							rows="5"
							value={calendarsMultiline}
							onChange={(event) => {
								const values = event.target.value
									.split('\n')
									.map((value) => value.trim())
									.filter(Boolean);
								updateField('followedCalendars', values);
							}}
						/>
					</label>
				</section>

				<section className="settings-card">
					<h2>Weather and Dark Mode</h2>

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
					<button type="submit" className="settings-save" disabled={isSaving}>
						{isSaving ? 'Saving...' : 'Save Changes'}
					</button>
					<button
						type="button"
						className="settings-reset"
						onClick={() => {
							setForm(normalizeSettings(initialSettings));
							setStatus('Changes reset.');
						}}
					>
						Reset
					</button>
					<span className="settings-status" aria-live="polite">{status}</span>
				</div>
			</form>
		</div>
	);
}
