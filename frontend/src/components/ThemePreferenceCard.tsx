import { memo } from 'react';
import Button from '@atlaskit/button/standard-button';
import { useTheme, ThemeMode } from '../context/ThemeContext';

const OPTIONS: { value: ThemeMode; label: string; icon: string; description: string }[] = [
  { value: 'light', label: 'Hell', icon: '☀', description: 'Heller Hintergrund' },
  { value: 'dark', label: 'Dunkel', icon: '☾', description: 'Dunkler Hintergrund' },
  { value: 'auto', label: 'Automatisch', icon: '◐', description: 'Folgt dem Systemdesign' },
];

function ThemePreferenceCard() {
  const { mode, resolvedTheme, setMode } = useTheme();

  return (
    <div className="card" style={{ maxWidth: '600px' }}>
      <h2>Erscheinungsbild</h2>
      <p style={{ color: 'var(--ds-text-subtle)', fontSize: '13px', marginTop: 0 }}>
        Aktuell aktiv: <strong>{resolvedTheme === 'dark' ? 'Dunkel' : 'Hell'}</strong>
        {mode === 'auto' && ' (via Systemeinstellung)'}
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            appearance={mode === opt.value ? 'primary' : 'default'}
            onClick={() => setMode(opt.value)}
            iconBefore={<span aria-hidden="true" style={{ fontSize: '16px' }}>{opt.icon}</span>}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default memo(ThemePreferenceCard);
