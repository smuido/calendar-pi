import React, { useState } from 'react';
import './defaultTheme/login.css';

export default function LoginScreen() {
	const [isStartingLogin, setIsStartingLogin] = useState(false);

	async function handleLoginClick() {
		if (isStartingLogin || typeof window.electronAPI?.startLogin !== 'function') {
			return;
		}

		setIsStartingLogin(true);

		try {
			await window.electronAPI.startLogin();
		} catch (error) {
			console.error('Failed to start login flow:', error);
		} finally {
			setIsStartingLogin(false);
		}
	}

	return (
		<div className="login-root">
			<div className="login-layout">
				<div className="login-logo-panel" aria-hidden="true">
					<div className="login-logo-mark">
						<span className="login-logo-ring login-logo-ring-large" />
						<span className="login-logo-ring login-logo-ring-small" />
						<span className="login-logo-dot" />
					</div>
					<div className="login-logo-type">
						<p className="login-logo-kicker">Daily planning, simplified</p>
						<h1 className="login-logo-title">Calendar Pi</h1>
					</div>
				</div>

				<div className="login-card">
					<h2 className="login-title">Welcome to Calendar Pi!</h2>
					<p className="login-message">Please log in with the button below.</p>
					<button
						type="button"
						className="login-button"
						onClick={handleLoginClick}
						disabled={isStartingLogin}
					>
						{isStartingLogin ? 'Opening...' : 'Login'}
					</button>
				</div>
			</div>
		</div>
	);
}
