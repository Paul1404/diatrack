import { memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Button from '@atlaskit/button/standard-button';
import Tooltip from '@atlaskit/tooltip';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BottomNav from './BottomNav';
import DashboardIcon from '@atlaskit/icon/core/dashboard';
import ChartBarIcon from '@atlaskit/icon/core/chart-bar';
import ClockIcon from '@atlaskit/icon/core/clock';
import SettingsIcon from '@atlaskit/icon/core/settings';
import LogOutIcon from '@atlaskit/icon/core/log-out';

function ThemeToggleButton() {
  const { mode, resolvedTheme, cycleMode } = useTheme();
  const label =
    mode === 'light'
      ? 'Helles Design (Klick für Dunkel)'
      : mode === 'dark'
      ? 'Dunkles Design (Klick für Auto)'
      : `Automatisch (${resolvedTheme === 'dark' ? 'dunkel' : 'hell'}) (Klick für Hell)`;

  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={cycleMode}
        className="theme-toggle"
        aria-label={label}
        data-theme-mode={mode}
      >
        <span aria-hidden="true" className="theme-toggle-icon">
          {mode === 'light' ? '☀' : mode === 'dark' ? '☾' : '◐'}
        </span>
      </button>
    </Tooltip>
  );
}

const MemoThemeToggle = memo(ThemeToggleButton);

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="48" fill="white" />
            <path d="M50 15 C50 15 25 45 25 60 C25 75 36 85 50 85 C64 85 75 75 75 60 C75 45 50 15 50 15 Z" fill="#0052CC" />
            <path d="M32 58 Q38 52 44 58 Q50 64 56 58 Q62 52 68 58" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
          DiaTrack
        </h1>

        {/* Desktop navigation — hidden on mobile, where the bottom bar takes over */}
        <nav className="header-nav">
          <NavLink to="/" className={location.pathname === '/' ? 'active' : ''}>
            <DashboardIcon label="" /> Übersicht
          </NavLink>
          <NavLink
            to="/statistics"
            className={location.pathname === '/statistics' ? 'active' : ''}
          >
            <ChartBarIcon label="" /> Statistiken
          </NavLink>
          <NavLink
            to="/history"
            className={location.pathname === '/history' ? 'active' : ''}
          >
            <ClockIcon label="" /> Verlauf
          </NavLink>
          <NavLink
            to="/settings"
            className={location.pathname === '/settings' ? 'active' : ''}
          >
            <SettingsIcon label="" /> Einstellungen
          </NavLink>
          <div className="nav-user">
            <MemoThemeToggle />
            <span className="nav-email">{user?.email}</span>
            <Button appearance="subtle" iconBefore={<LogOutIcon label="" />} onClick={logout} style={{ color: 'white' }}>
              Abmelden
            </Button>
          </div>
        </nav>

        {/* Compact action cluster — only shown on mobile */}
        <div className="header-actions">
          <MemoThemeToggle />
          <Tooltip content="Abmelden">
            <button
              type="button"
              onClick={logout}
              className="header-icon-button"
              aria-label="Abmelden"
            >
              <LogOutIcon label="" />
            </button>
          </Tooltip>
        </div>
      </header>

      <main className="main-content">{children}</main>

      <BottomNav />
    </div>
  );
}
