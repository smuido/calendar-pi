import React from 'react';
import './navbar.css';

export default function Navbar({ activeView, onViewChange }) {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <button
                    className={`navbar-button ${activeView === 'month' ? 'active' : ''}`}
                    onClick={() => onViewChange('month')}
                >
                    <span className="navbar-icon">📅</span>
                    <span className="navbar-label">Month View</span>
                </button>

                <button
                    className={`navbar-button ${activeView === 'week' ? 'active' : ''}`}
                    onClick={() => onViewChange('week')}
                >
                    <span className="navbar-icon">📋</span>
                    <span className="navbar-label">Week View</span>
                </button>

                <button
                    className={`navbar-button ${activeView === 'settings' ? 'active' : ''}`}
                    onClick={() => onViewChange('settings')}
                >
                    <span className="navbar-icon">⚙️</span>
                    <span className="navbar-label">Settings</span>
                </button>
            </div>
        </nav>
    );
}
