import { useState, useEffect, useMemo, useCallback } from 'react';
import Lozenge from '@atlaskit/lozenge';
import Button from '@atlaskit/button/standard-button';
import Select from '@atlaskit/select';
import DynamicTable from '@atlaskit/dynamic-table';
import { HistoryEntry, getHistory } from '../services/api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import PulseIcon from '@atlaskit/icon/core/pulse';
import FlaskIcon from '@atlaskit/icon/core/flask';
import { useIsMobile } from '../lib/useMediaQuery';

type LozengeAppearance = 'inprogress' | 'success' | 'removed';

function statusAppearance(status: string): LozengeAppearance {
  if (status === 'active') return 'inprogress';
  if (status === 'completed') return 'success';
  return 'removed';
}

function statusLabel(entry: HistoryEntry): string {
  if (entry.status === 'active') return 'Aktiv';
  if (entry.status === 'completed') return 'Abgeschlossen';
  return entry.failure_reason || 'Defekt';
}

function TypeLabel({ type }: { type: string }) {
  return type === 'sensor' ? (
    <><PulseIcon label="" /> Sensor</>
  ) : (
    <><FlaskIcon label="" /> Katheter</>
  );
}

function formatDate(value: string | null): string {
  return value ? format(new Date(value), 'dd.MM.yyyy HH:mm', { locale: de }) : '-';
}

function durationText(entry: HistoryEntry): string {
  if (!entry.actual_duration_hours) return '-';
  return `${Math.round(entry.actual_duration_hours)}h / ${Math.round(
    entry.planned_duration_hours,
  )}h geplant`;
}

const daysOptions = [
  { value: 30, label: 'Letzte 30 Tage' },
  { value: 90, label: 'Letzte 90 Tage' },
  { value: 180, label: 'Letzte 6 Monate' },
  { value: 365, label: 'Letztes Jahr' },
];

export default function History() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [days, setDays] = useState(90);
  const isMobile = useIsMobile();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    const { data, error } = await getHistory(days);
    if (data) {
      setHistory(data);
    } else if (error !== 'Unauthorized') {
      setLoadError(true);
    }
    setIsLoading(false);
  }, [days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const head = {
    cells: [
      { key: 'type', content: 'Typ', isSortable: true },
      { key: 'location', content: 'Körperstelle', isSortable: true },
      { key: 'start', content: 'Gestartet', isSortable: true },
      { key: 'end', content: 'Beendet', isSortable: true },
      { key: 'duration', content: 'Dauer', isSortable: true },
      { key: 'status', content: 'Status', isSortable: true },
    ],
  };

  const rows = useMemo(
    () =>
      history.map((entry) => ({
        key: String(entry.id),
        cells: [
          { key: 'type', content: <TypeLabel type={entry.device_type} /> },
          { key: 'location', content: entry.body_location_label },
          { key: 'start', content: formatDate(entry.start_time) },
          { key: 'end', content: formatDate(entry.ended_at) },
          {
            key: 'duration',
            content: (
              <span>
                {entry.actual_duration_hours
                  ? `${Math.round(entry.actual_duration_hours)}h`
                  : '-'}
                {entry.actual_duration_hours && (
                  <span style={{ color: 'var(--ds-text-subtle)', marginLeft: '4px' }}>
                    / {Math.round(entry.planned_duration_hours)}h geplant
                  </span>
                )}
              </span>
            ),
          },
          {
            key: 'status',
            content: (
              <Lozenge appearance={statusAppearance(entry.status)}>
                {statusLabel(entry)}
              </Lozenge>
            ),
          },
        ],
      })),
    [history],
  );

  return (
    <div>
      <div
        className="history-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <h1 style={{ margin: 0 }}>Verlauf</h1>
        <div style={{ width: '200px', minWidth: '200px' }}>
          <Select
            options={daysOptions}
            value={daysOptions.find((o) => o.value === days)}
            onChange={(option) => option && setDays(option.value)}
            aria-label="Zeitraum"
          />
        </div>
      </div>

      {loadError ? (
        <div className="card load-error">
          <h3>Verlauf konnte nicht geladen werden</h3>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button appearance="primary" onClick={loadData}>
            Erneut versuchen
          </Button>
        </div>
      ) : isLoading ? (
        <div className="card empty-state">Laden...</div>
      ) : history.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Keine Einträge</h3>
            <p>Im ausgewählten Zeitraum wurden keine Geräte erfasst.</p>
          </div>
        </div>
      ) : isMobile ? (
        <div className="history-cards">
          {history.map((entry) => (
            <div key={entry.id} className={`history-card ${entry.device_type}`}>
              <div className="history-card-top">
                <span className="history-card-type">
                  <TypeLabel type={entry.device_type} />
                </span>
                <Lozenge appearance={statusAppearance(entry.status)}>
                  {statusLabel(entry)}
                </Lozenge>
              </div>
              <div className="history-card-location">{entry.body_location_label}</div>
              <dl className="history-card-rows">
                <dt>Gestartet</dt>
                <dd>{formatDate(entry.start_time)}</dd>
                <dt>Beendet</dt>
                <dd>{formatDate(entry.ended_at)}</dd>
                <dt>Dauer</dt>
                <dd>{durationText(entry)}</dd>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <DynamicTable
            head={head}
            rows={rows}
            rowsPerPage={20}
            defaultPage={1}
            loadingSpinnerSize="large"
            isRankable={false}
          />
        </div>
      )}
    </div>
  );
}
