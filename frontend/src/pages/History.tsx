import { useState, useEffect, useMemo } from 'react';
import Lozenge from '@atlaskit/lozenge';
import Select from '@atlaskit/select';
import DynamicTable from '@atlaskit/dynamic-table';
import { HistoryEntry, getHistory } from '../services/api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import PulseIcon from '@atlaskit/icon/core/pulse';
import FlaskIcon from '@atlaskit/icon/core/flask';

export default function History() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(90);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const { data } = await getHistory(days);
      if (data) setHistory(data);
      setIsLoading(false);
    }
    loadData();
  }, [days]);

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

  const rows = useMemo(() => history.map((entry) => ({
    key: String(entry.id),
    cells: [
      {
        key: 'type',
        content: entry.device_type === 'sensor'
          ? <><PulseIcon label="" /> Sensor</>
          : <><FlaskIcon label="" /> Katheter</>,
      },
      {
        key: 'location',
        content: entry.body_location_label,
      },
      {
        key: 'start',
        content: format(new Date(entry.start_time), 'dd.MM.yyyy HH:mm', {
          locale: de,
        }),
      },
      {
        key: 'end',
        content: entry.ended_at
          ? format(new Date(entry.ended_at), 'dd.MM.yyyy HH:mm', { locale: de })
          : '-',
      },
      {
        key: 'duration',
        content: (
          <span>
            {entry.actual_duration_hours
              ? `${Math.round(entry.actual_duration_hours)}h`
              : '-'}
            {entry.actual_duration_hours && (
              <span style={{ color: '#6B778C', marginLeft: '4px' }}>
                / {Math.round(entry.planned_duration_hours)}h geplant
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'status',
        content: (
          <Lozenge
            appearance={
              entry.status === 'active'
                ? 'inprogress'
                : entry.status === 'completed'
                ? 'success'
                : 'removed'
            }
          >
            {entry.status === 'active'
              ? 'Aktiv'
              : entry.status === 'completed'
              ? 'Abgeschlossen'
              : entry.failure_reason || 'Defekt'}
          </Lozenge>
        ),
      },
    ],
  })), [history]);

  const daysOptions = [
    { value: 30, label: 'Letzte 30 Tage' },
    { value: 90, label: 'Letzte 90 Tage' },
    { value: 180, label: 'Letzte 6 Monate' },
    { value: 365, label: 'Letztes Jahr' },
  ];

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
          />
        </div>
      </div>

      <div className="card">
        {history.length === 0 ? (
          <div className="empty-state">
            <h3>Keine Einträge</h3>
            <p>Im ausgewählten Zeitraum wurden keine Geräte erfasst.</p>
          </div>
        ) : (
          <DynamicTable
            head={head}
            rows={rows}
            isLoading={isLoading}
            rowsPerPage={20}
            defaultPage={1}
            loadingSpinnerSize="large"
            isRankable={false}
          />
        )}
      </div>
    </div>
  );
}
