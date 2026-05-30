import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import DashboardIcon from '@atlaskit/icon/core/dashboard';
import ChartBarIcon from '@atlaskit/icon/core/chart-bar';
import ClockIcon from '@atlaskit/icon/core/clock';
import SettingsIcon from '@atlaskit/icon/core/settings';

const ITEMS = [
  { to: '/', label: 'Übersicht', Icon: DashboardIcon },
  { to: '/statistics', label: 'Statistik', Icon: ChartBarIcon },
  { to: '/history', label: 'Verlauf', Icon: ClockIcon },
  { to: '/settings', label: 'Mehr', Icon: SettingsIcon },
];

/**
 * Fixed bottom tab bar for mobile. Kept within thumb reach so the four main
 * destinations are reachable one-handed. Hidden on desktop via CSS.
 */
function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? ' active' : ''}`
          }
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <Icon label="" />
          </span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default memo(BottomNav);
