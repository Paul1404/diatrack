import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@atlaskit/button/standard-button';
import LoadingButton from '@atlaskit/button/loading-button';
import Lozenge from '@atlaskit/lozenge';
import Select from '@atlaskit/select';
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from '@atlaskit/modal-dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import DeleteIcon from '@atlaskit/icon/core/delete';
import {
  EmailLogEntry,
  EmailLogStatus,
  getEmailLogs,
  clearEmailLogs,
} from '../services/api';

type StatusFilter = 'all' | EmailLogStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Alle Status' },
  { value: 'success', label: 'Erfolgreich' },
  { value: 'failed', label: 'Fehlgeschlagen' },
  { value: 'skipped', label: 'Übersprungen' },
];

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<string, string> = {
  device_reminder: 'Geräte-Erinnerung',
  smtp_test: 'SMTP-Test',
  other: 'Sonstige',
};

function StatusBadge({ status, label }: { status: EmailLogStatus; label: string }) {
  const appearance =
    status === 'success' ? 'success' : status === 'failed' ? 'removed' : 'default';
  return <Lozenge appearance={appearance}>{label}</Lozenge>;
}

export default function EmailLogsPanel() {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showClearModal, setShowClearModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(
    async (filter: StatusFilter = statusFilter) => {
      setIsLoading(true);
      setErrorMessage(null);
      const { data, error } = await getEmailLogs({
        limit: PAGE_SIZE,
        status: filter === 'all' ? undefined : filter,
      });
      if (data) {
        setEntries(data.entries);
        setTotal(data.total);
      } else {
        setErrorMessage(error || 'Fehler beim Laden der E-Mail-Logs');
      }
      setIsLoading(false);
    },
    [statusFilter],
  );

  useEffect(() => {
    load(statusFilter);
  }, [load, statusFilter]);

  const handleClear = useCallback(async () => {
    setIsClearing(true);
    const { error } = await clearEmailLogs();
    setIsClearing(false);
    setShowClearModal(false);
    if (error) {
      setErrorMessage(error);
    } else {
      setEntries([]);
      setTotal(0);
    }
  }, []);

  const currentStatusOption = useMemo(
    () => STATUS_OPTIONS.find((o) => o.value === statusFilter) || STATUS_OPTIONS[0],
    [statusFilter],
  );

  return (
    <div className="card" style={{ maxWidth: '960px', marginTop: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <h2 style={{ margin: 0 }}>
          E-Mail-Logs <span style={{ color: 'var(--ds-text-subtle)', fontWeight: 400 }}>({total})</span>
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ minWidth: '180px' }}>
            <Select<{ value: StatusFilter; label: string }>
              options={STATUS_OPTIONS}
              value={currentStatusOption}
              onChange={(opt) => setStatusFilter((opt?.value as StatusFilter) || 'all')}
              isSearchable={false}
              spacing="compact"
            />
          </div>
          <Button
            iconBefore={<RefreshIcon label="" />}
            onClick={() => load(statusFilter)}
            isDisabled={isLoading}
          >
            Aktualisieren
          </Button>
          <Button
            appearance="danger"
            iconBefore={<DeleteIcon label="" />}
            onClick={() => setShowClearModal(true)}
            isDisabled={isLoading || entries.length === 0}
          >
            Leeren
          </Button>
        </div>
      </div>

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <p style={{ color: 'var(--ds-text-subtle)', fontSize: '13px', marginTop: 0 }}>
        Jeder E-Mail-Versand (Erinnerungen, SMTP-Tests) wird hier protokolliert.
        Zeigt die letzten {PAGE_SIZE} Einträge.
      </p>

      {isLoading ? (
        <div className="empty-state">Laden...</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <h3>Keine Einträge</h3>
          <p>Bisher wurden keine E-Mails versendet.</p>
        </div>
      ) : (
        <div className="table-scroll-wrapper">
          <table>
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Status</th>
                <th>Typ</th>
                <th>Empfänger</th>
                <th>Betreff</th>
                <th style={{ textAlign: 'right' }}>Dauer</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => {
                const expanded = expandedId === row.id;
                const typeLabel = TYPE_LABELS[row.email_type] || row.email_type;
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      style={{ cursor: row.error_message ? 'pointer' : 'default' }}
                    >
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--ds-text-subtle)', fontSize: '12px' }}>
                        {row.created_at
                          ? format(new Date(row.created_at), 'dd.MM.yyyy HH:mm:ss', { locale: de })
                          : '-'}
                      </td>
                      <td>
                        <StatusBadge status={row.status} label={row.status_label} />
                      </td>
                      <td style={{ fontSize: '13px' }}>{typeLabel}</td>
                      <td style={{ fontSize: '13px' }}>{row.to_email}</td>
                      <td style={{ fontSize: '13px' }}>{row.subject}</td>
                      <td style={{ textAlign: 'right', fontSize: '12px', color: 'var(--ds-text-subtle)' }}>
                        {row.duration_ms !== null ? `${row.duration_ms}ms` : '-'}
                      </td>
                    </tr>
                    {expanded && row.error_message && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--ds-background-neutral-subtle)' }}>
                          <strong>Fehler:</strong>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              margin: '8px 0 0',
                              fontSize: '12px',
                              color: 'var(--ds-text-danger)',
                            }}
                          >
                            {row.error_message}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalTransition>
        {showClearModal && (
          <Modal onClose={() => setShowClearModal(false)} width="small">
            <ModalHeader>
              <ModalTitle appearance="danger">E-Mail-Logs löschen</ModalTitle>
            </ModalHeader>
            <ModalBody>
              Alle Log-Einträge werden unwiderruflich entfernt. Neue E-Mails werden wieder protokolliert.
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setShowClearModal(false)}>
                Abbrechen
              </Button>
              <LoadingButton
                appearance="danger"
                onClick={handleClear}
                isLoading={isClearing}
              >
                Endgültig löschen
              </LoadingButton>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}
