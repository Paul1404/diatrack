import React from 'react'
import ReactDOM from 'react-dom/client'
import '@atlaskit/css-reset'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

// Apply stored theme BEFORE React hydrates to avoid a flash of wrong theme.
(function initTheme() {
  try {
    const stored = localStorage.getItem('diatrack.theme');
    const mode = stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch {
    /* ignore */
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
