import { useState, useEffect } from 'react';
import {
  OverviewStats,
  FailureStats,
  getOverviewStats,
  getFailureStats,
} from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,

} from 'recharts';

const COLORS = ['#0052CC', '#6554C0', '#00B8D9', '#36B37E', '#FF991F', '#DE350B'];

export default function Statistics() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [failures, setFailures] = useState<FailureStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [overviewRes, failuresRes] = await Promise.all([
        getOverviewStats(),
        getFailureStats(),
      ]);

      if (overviewRes.data) setOverview(overviewRes.data);
      if (failuresRes.data) setFailures(failuresRes.data);
      setIsLoading(false);
    }
    loadData();
  }, []);

  if (isLoading) {
    return <div>Laden...</div>;
  }

  if (!overview || !failures) {
    return <div>Fehler beim Laden der Statistiken</div>;
  }

  const mtbfData = failures.by_device_type.map((dt) => ({
    name: dt.device_type === 'sensor' ? 'Sensor' : 'Katheter',
    mtbf: dt.mtbf_hours || 0,
    failures: dt.total_failures,
    completed: dt.total_completed,
  }));

  const locationData = failures.by_location.map((loc) => ({
    name: loc.body_location_label,
    total: loc.total_devices,
    failed: loc.failed_devices,
    rate: loc.failure_rate,
  }));

  const reasonData = failures.by_reason.map((r) => ({
    name: r.reason_label,
    value: r.count,
  }));

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Statistiken</h1>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{overview.total_devices}</div>
          <div className="stat-label">Geräte gesamt</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#36B37E' }}>
            {overview.active_devices}
          </div>
          <div className="stat-label">Aktiv</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#00B8D9' }}>
            {overview.completed_devices}
          </div>
          <div className="stat-label">Abgeschlossen</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#DE350B' }}>
            {overview.failed_devices}
          </div>
          <div className="stat-label">Defekt</div>
        </div>
      </div>

      <div className="stats-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Failure Rates */}
        <div className="card">
          <h2>Ausfallraten</h2>
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '24px' }}>
                {overview.sensor_failure_rate}%
              </div>
              <div className="stat-label">Sensor-Ausfallrate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '24px' }}>
                {overview.catheter_failure_rate}%
              </div>
              <div className="stat-label">Katheter-Ausfallrate</div>
            </div>
          </div>
        </div>

        {/* Average Duration */}
        <div className="card">
          <h2>Durchschnittliche Laufzeit</h2>
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '24px' }}>
                {overview.avg_sensor_duration_hours
                  ? `${Math.round(overview.avg_sensor_duration_hours)}h`
                  : '-'}
              </div>
              <div className="stat-label">Sensor (Ø)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '24px' }}>
                {overview.avg_catheter_duration_hours
                  ? `${Math.round(overview.avg_catheter_duration_hours)}h`
                  : '-'}
              </div>
              <div className="stat-label">Katheter (Ø)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="stats-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        {/* Failure Reasons Pie Chart */}
        <div className="card">
          <h2>Ausfallgründe</h2>
          {reasonData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    dataKey="value"
                  >
                    {reasonData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <p>Noch keine Ausfälle erfasst</p>
            </div>
          )}
        </div>

        {/* Failure by Location Bar Chart */}
        <div className="card">
          <h2>Ausfallrate nach Körperstelle</h2>
          {locationData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit="%" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="rate" fill="#0052CC" name="Ausfallrate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <p>Noch keine Daten verfügbar</p>
            </div>
          )}
        </div>
      </div>

      {/* MTBF */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>MTBF (Mean Time Between Failure)</h2>
        <div className="stats-grid">
          {mtbfData.map((dt) => (
            <div key={dt.name} className="stat-card">
              <div className="stat-value" style={{ fontSize: '24px' }}>
                {dt.mtbf > 0 ? `${Math.round(dt.mtbf)}h` : '-'}
              </div>
              <div className="stat-label">
                {dt.name}
                <br />
                <small style={{ fontSize: '11px' }}>
                  {dt.completed} OK / {dt.failures} Defekt
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
