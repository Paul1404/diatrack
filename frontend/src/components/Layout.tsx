import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Button from '@atlaskit/button/standard-button';
import { useAuth } from '../context/AuthContext';
import DashboardIcon from '@atlaskit/icon/core/dashboard';
import ChartBarIcon from '@atlaskit/icon/core/chart-bar';
import ClockIcon from '@atlaskit/icon/core/clock';
import SettingsIcon from '@atlaskit/icon/core/settings';
import LogOutIcon from '@atlaskit/icon/core/log-out';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <svg width="28" height="28" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="white"/>
            <path d="M50 15 C50 15 25 45 25 60 C25 75 36 85 50 85 C64 85 75 75 75 60 C75 45 50 15 50 15 Z" fill="#0052CC"/>
            <path d="M32 58 Q38 52 44 58 Q50 64 56 58 Q62 52 68 58" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
          </svg>
          DiaTrack
        </h1>
        <button
          className={`hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menü"
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={menuOpen ? 'open' : ''}>
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
            <span className="nav-email">{user?.email}</span>
            <Button appearance="subtle" iconBefore={<LogOutIcon label="" />} onClick={logout} style={{ color: 'white' }}>
              Abmelden
            </Button>
          </div>
        </nav>
      </header>
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}
      <main className="main-content">{children}</main>
    </div>
  );
}
