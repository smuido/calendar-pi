import { useEffect, useState } from 'react';

export default function Settings() {
    const [theme, setTheme] = useState('light');
    const [autoSync, setAutoSync] = useState(true);
    const [refreshValue, setRefreshValue] = useState(() => {
        const stored = localStorage.getItem('refreshFrequency') || '1 hour';
        const match = stored.match(/(\d+)/);
        return match ? match[1] : '1';
    });
    const [refreshUnit, setRefreshUnit] = useState(() => {
        const stored = localStorage.getItem('refreshFrequency') || '1 hour';
        if (stored.includes('day')) return 'days';
        if (stored.includes('hour')) return 'hours';
        return 'minutes';
    });
    const [syncStatus, setSyncStatus] = useState('idle');
    const [firstDayOfWeek, setFirstDayOfWeek] = useState('Sunday');

    const unitOptions = ['minutes', 'hours', 'days'];
    const weekDayOptions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const handleThemeChange = (e) => {
        setTheme(e.target.value);
        document.documentElement.setAttribute('data-theme', e.target.value);
    };

    const syncRefreshFrequency = async (value) => {
        setSyncStatus('syncing');
        try {
            await fetch('http://127.0.0.1:8787/api/settings/refresh-frequency', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshFrequency: value }),
            });
            setSyncStatus('synced');
        } catch (error) {
            setSyncStatus('error');
            console.error('Failed to sync refresh frequency setting', error);
        }
    };

    const handleRefreshValueChange = (e) => {
        setRefreshValue(e.target.value);
    };

    const handleRefreshUnitChange = (e) => {
        setRefreshUnit(e.target.value);
    };

    useEffect(() => {
        const freq = `${refreshValue} ${refreshUnit}`;
        localStorage.setItem('refreshFrequency', freq);
        syncRefreshFrequency(freq);
    }, [refreshValue, refreshUnit]);

    const handleLogout = () => {
        // Clear auth data and redirect to login
        localStorage.removeItem('token.json');
        window.location.href = '/login';
    };

    return (
        <div className="settings-container">
            <h1>Settings</h1>

            <div className="settings-section">
                <h2>Appearance</h2>
                <label>
                    Theme:
                    <select value={theme} onChange={handleThemeChange}>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                    </select>
                </label>
            </div>

            <div className="settings-section">
                <h2>Preferences</h2>
                <label>
                    Refresh frequency:
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                            type="number"
                            min="1"
                            value={refreshValue}
                            onChange={handleRefreshValueChange}
                            style={{ width: '60px' }}
                        />
                        <select value={refreshUnit} onChange={handleRefreshUnitChange}>
                            {unitOptions.map((unit) => (
                                <option key={unit} value={unit}>
                                    {unit}
                                </option>
                            ))}
                        </select>
                    </div>
                </label>
                <p>{syncStatus === 'syncing' ? 'Syncing refresh setting...' : syncStatus === 'synced' ? 'Refresh setting synced.' : syncStatus === 'error' ? 'Could not sync refresh setting.' : ''}</p>
                <label>
                    First day of week:
                    <select value={firstDayOfWeek} onChange={(e) => setFirstDayOfWeek(e.target.value)}>
                        {weekDayOptions.map((day) => (
                            <option key={day} value={day}>
                                {day}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                    />
                    Auto Sync
                </label>
            </div>

            <div className="settings-section">
                <button className="logout-btn" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </div>
    );
}