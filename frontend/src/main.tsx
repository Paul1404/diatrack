import React from 'react'
import ReactDOM from 'react-dom/client'
import '@atlaskit/css-reset'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// Apply stored theme BEFORE React hydrates to avoid a flash of wrong theme.
(function initTheme() {
  try {
    const stored = localStorage.getItem('diatrack.theme');
    const mode = stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
    const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch {
    /* ignore */
  }
})();

// Last-resort safety net: if React fails to mount entirely, replace the
// boot splash with a visible error + reload so mobile users aren't stuck
// staring at a white screen with no feedback.
function showBootError(message: string) {
  const root = document.getElementById('root');
  if (!root) return;
  if (root.dataset.bootError === '1') return;
  root.dataset.bootError = '1';
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:420px;width:100%;background:#FFFFFF;color:#172B4D;padding:32px 28px;border-radius:8px;box-shadow:0 1px 1px rgba(9,30,66,.25),0 0 1px rgba(9,30,66,.31);text-align:center;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">App konnte nicht geladen werden</h1>
        <p style="margin:0 0 24px;color:#626F86;font-size:14px;line-height:1.5;">Bitte prüfe deine Internetverbindung und lade die Seite neu.</p>
        ${message ? `<pre style="text-align:left;background:#F7F8F9;padding:12px;border-radius:4px;font-size:12px;overflow:auto;max-height:120px;margin:0 0 20px;color:#626F86;">${message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>` : ''}
        <button type="button" onclick="window.location.reload()" style="background:#0052CC;color:#FFFFFF;border:none;border-radius:3px;padding:10px 20px;font-size:14px;font-weight:500;cursor:pointer;width:100%;">Neu laden</button>
      </div>
    </div>
  `;
}

window.addEventListener('error', (event) => {
  // Only handle errors before React has mounted.
  const root = document.getElementById('root');
  if (root && root.childElementCount > 0 && root.dataset.bootError !== '1') return;
  showBootError(event.message || 'Unbekannter Fehler');
});

window.addEventListener('unhandledrejection', (event) => {
  const root = document.getElementById('root');
  if (root && root.childElementCount > 0 && root.dataset.bootError !== '1') return;
  const reason = event.reason;
  const message =
    reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unbekannter Fehler';
  showBootError(message);
});

const container = document.getElementById('root');
if (!container) {
  showBootError('Root element not found');
} else {
  try {
    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <ErrorBoundary>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showBootError(message);
  }
}
