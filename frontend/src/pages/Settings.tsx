import { useState, useEffect } from 'react';
import Button from '@atlaskit/button/standard-button';
import LoadingButton from '@atlaskit/button/loading-button';
import Textfield from '@atlaskit/textfield';
import Toggle from '@atlaskit/toggle';
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from '@atlaskit/modal-dialog';
import { 
  UserSettings, 
  getSettings, 
  updateSettings,
  getAppSettings,
  updateAppSettings,
  testSmtp,
  clearHistory,
} from '../services/api';
import DeleteIcon from '@atlaskit/icon/core/delete';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearMessage, setClearMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [smtpMessage, setSmtpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // User settings form state
  const [sensorHours, setSensorHours] = useState('');
  const [catheterHours, setCatheterHours] = useState('');
  const [reminderIntervals, setReminderIntervals] = useState('');

  // App settings form state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTls, setSmtpTls] = useState(true);
  const [appUrl, setAppUrl] = useState('');
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const userRes = await getSettings();
      
      if (userRes.data) {
        setSettings(userRes.data);
        setSensorHours(String(userRes.data.sensor_default_hours));
        setCatheterHours(String(userRes.data.catheter_default_hours));
        setReminderIntervals(userRes.data.reminder_intervals_hours.join(', '));
      }

      // SMTP/app-wide settings are restricted to superusers.
      if (user?.is_superuser) {
        const appRes = await getAppSettings();
        if (appRes.data) {
          setSmtpHost(appRes.data.smtp_host || '');
          setSmtpPort(String(appRes.data.smtp_port || 587));
          setSmtpUser(appRes.data.smtp_user || '');
          setSmtpFrom(appRes.data.smtp_from || '');
          setSmtpTls(appRes.data.smtp_tls);
          setAppUrl(appRes.data.app_url || '');
        }
      }
      
      setIsLoading(false);
    }
    loadSettings();
  }, [user?.is_superuser]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    const intervals = reminderIntervals
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    const { data, error } = await updateSettings({
      sensor_default_hours: parseInt(sensorHours, 10),
      catheter_default_hours: parseInt(catheterHours, 10),
      reminder_intervals_hours: intervals,
    });

    setIsSaving(false);

    if (data) {
      setSettings(data);
      setMessage({ type: 'success', text: 'Einstellungen gespeichert!' });
    } else {
      setMessage({ type: 'error', text: error || 'Fehler beim Speichern' });
    }
  };

  const handleSaveSmtp = async () => {
    setIsSavingSmtp(true);
    setSmtpMessage(null);

    const updates: Record<string, unknown> = {
      smtp_host: smtpHost,
      smtp_port: parseInt(smtpPort, 10),
      smtp_user: smtpUser,
      smtp_from: smtpFrom,
      smtp_tls: smtpTls,
      app_url: appUrl,
    };
    
    // Only include password if it was changed
    if (smtpPassword) {
      updates.smtp_password = smtpPassword;
    }

    const { data, error } = await updateAppSettings(updates);

    setIsSavingSmtp(false);

    if (data) {
      setSmtpPassword(''); // Clear password field after save
      setSmtpMessage({ type: 'success', text: 'SMTP-Einstellungen gespeichert!' });
    } else {
      setSmtpMessage({ type: 'error', text: error || 'Fehler beim Speichern' });
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmail) {
      setSmtpMessage({ type: 'error', text: 'Bitte E-Mail-Adresse eingeben' });
      return;
    }
    
    setIsTesting(true);
    setSmtpMessage(null);

    const { data, error } = await testSmtp(testEmail);

    setIsTesting(false);

    if (data) {
      setSmtpMessage({ type: 'success', text: 'Test-E-Mail erfolgreich gesendet!' });
    } else {
      setSmtpMessage({ type: 'error', text: error || 'Fehler beim Senden' });
    }
  };

  if (isLoading) {
    return <div>Laden...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Einstellungen</h1>

      <div className="card" style={{ maxWidth: '600px' }}>
        <h2>Standard-Laufzeiten</h2>

        {message && (
          <div
            className={message.type === 'error' ? 'error-message' : ''}
            style={
              message.type === 'success'
                ? {
                    background: '#E3FCEF',
                    color: '#006644',
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '16px',
                  }
                : {}
            }
          >
            {message.text}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="sensorHours">Sensor-Laufzeit (Stunden)</label>
          <Textfield
            id="sensorHours"
            type="number"
            value={sensorHours}
            onChange={(e) => setSensorHours((e.target as HTMLInputElement).value)}
            placeholder="240"
          />
          <small style={{ color: '#6B778C' }}>
            Standard: 240 Stunden (10 Tage)
          </small>
        </div>

        <div className="form-field">
          <label htmlFor="catheterHours">Katheter-Laufzeit (Stunden)</label>
          <Textfield
            id="catheterHours"
            type="number"
            value={catheterHours}
            onChange={(e) => setCatheterHours((e.target as HTMLInputElement).value)}
            placeholder="72"
          />
          <small style={{ color: '#6B778C' }}>
            Standard: 72 Stunden (3 Tage)
          </small>
        </div>

        <h2 style={{ marginTop: '32px' }}>Erinnerungen</h2>

        <div className="form-field">
          <label htmlFor="reminderIntervals">
            Erinnerungs-Intervalle (Stunden vor Ablauf)
          </label>
          <Textfield
            id="reminderIntervals"
            value={reminderIntervals}
            onChange={(e) =>
              setReminderIntervals((e.target as HTMLInputElement).value)
            }
            placeholder="24, 6"
          />
          <small style={{ color: '#6B778C' }}>
            Kommagetrennte Liste, z.B. "24, 6" für Erinnerungen 24h und 6h vor Ablauf
          </small>
        </div>

        <div style={{ marginTop: '24px' }}>
          <LoadingButton
            appearance="primary"
            onClick={handleSave}
            isLoading={isSaving}
          >
            Speichern
          </LoadingButton>
        </div>
      </div>

      {user?.is_superuser && (
        <div className="card" style={{ maxWidth: '600px', marginTop: '24px' }}>
          <h2>E-Mail-Einstellungen (SMTP)</h2>
          
          {smtpMessage && (
            <div
              className={smtpMessage.type === 'error' ? 'error-message' : ''}
              style={
                smtpMessage.type === 'success'
                  ? {
                      background: '#E3FCEF',
                      color: '#006644',
                      padding: '12px',
                      borderRadius: '4px',
                      marginBottom: '16px',
                    }
                  : {}
              }
            >
              {smtpMessage.text}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="smtpHost">SMTP Server</label>
            <Textfield
              id="smtpHost"
              value={smtpHost}
              onChange={(e) => setSmtpHost((e.target as HTMLInputElement).value)}
              placeholder="smtp.example.com"
            />
          </div>

          <div className="form-field">
            <label htmlFor="smtpPort">SMTP Port</label>
            <Textfield
              id="smtpPort"
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort((e.target as HTMLInputElement).value)}
              placeholder="587"
            />
          </div>

          <div className="form-field">
            <label htmlFor="smtpUser">SMTP Benutzer</label>
            <Textfield
              id="smtpUser"
              value={smtpUser}
              onChange={(e) => setSmtpUser((e.target as HTMLInputElement).value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="form-field">
            <label htmlFor="smtpPassword">SMTP Passwort</label>
            <Textfield
              id="smtpPassword"
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword((e.target as HTMLInputElement).value)}
              placeholder="Nur ausfüllen um zu ändern"
            />
          </div>

          <div className="form-field">
            <label htmlFor="smtpFrom">Absender E-Mail</label>
            <Textfield
              id="smtpFrom"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom((e.target as HTMLInputElement).value)}
              placeholder="noreply@example.com"
            />
          </div>

          <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Toggle
              id="smtpTls"
              isChecked={smtpTls}
              onChange={() => setSmtpTls(!smtpTls)}
            />
            <label htmlFor="smtpTls" style={{ margin: 0 }}>TLS/STARTTLS verwenden</label>
          </div>

          <div className="form-field">
            <label htmlFor="appUrl">App URL (für E-Mail-Links)</label>
            <Textfield
              id="appUrl"
              value={appUrl}
              onChange={(e) => setAppUrl((e.target as HTMLInputElement).value)}
              placeholder="https://diatrack.example.com"
            />
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <LoadingButton
              appearance="primary"
              onClick={handleSaveSmtp}
              isLoading={isSavingSmtp}
            >
              SMTP speichern
            </LoadingButton>
          </div>

          <h3 style={{ marginTop: '32px' }}>SMTP testen</h3>
          <div className="form-field">
            <label htmlFor="testEmail">Test E-Mail senden an</label>
            <Textfield
              id="testEmail"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail((e.target as HTMLInputElement).value)}
              placeholder="test@example.com"
            />
          </div>
          <LoadingButton
            onClick={handleTestSmtp}
            isLoading={isTesting}
            isDisabled={!smtpHost}
          >
            Test-E-Mail senden
          </LoadingButton>
        </div>
      )}

      <div className="card" style={{ maxWidth: '600px', marginTop: '24px' }}>
        <h2>Daten verwalten</h2>

        {clearMessage && (
          <div
            className={clearMessage.type === 'error' ? 'error-message' : ''}
            style={
              clearMessage.type === 'success'
                ? {
                    background: '#E3FCEF',
                    color: '#006644',
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '16px',
                  }
                : {}
            }
          >
            {clearMessage.text}
          </div>
        )}

        <p style={{ color: '#626F86', marginBottom: '16px' }}>
          Hiermit werden alle abgeschlossenen und fehlerhaften Geräteeinträge gelöscht.
          Aktive Geräte bleiben erhalten. Dieser Vorgang kann nicht rückgängig gemacht werden.
        </p>

        <LoadingButton
          appearance="danger"
          iconBefore={<DeleteIcon label="" />}
          onClick={() => setShowClearModal(true)}
          isLoading={isClearing}
        >
          Historische Daten löschen
        </LoadingButton>

        <ModalTransition>
          {showClearModal && (
            <Modal onClose={() => setShowClearModal(false)} width="small">
              <ModalHeader>
                <ModalTitle appearance="danger">Historische Daten löschen</ModalTitle>
              </ModalHeader>
              <ModalBody>
                Alle abgeschlossenen und fehlerhaften Geräteeinträge werden unwiderruflich gelöscht.
                Aktive Geräte bleiben erhalten. Dieser Vorgang kann nicht rückgängig gemacht werden.
              </ModalBody>
              <ModalFooter>
                <Button appearance="subtle" onClick={() => setShowClearModal(false)}>
                  Abbrechen
                </Button>
                <LoadingButton
                  appearance="danger"
                  onClick={async () => {
                    setIsClearing(true);
                    setClearMessage(null);
                    const { error } = await clearHistory();
                    setIsClearing(false);
                    setShowClearModal(false);
                    if (!error) {
                      setClearMessage({ type: 'success', text: 'Historische Daten wurden gelöscht.' });
                    } else {
                      setClearMessage({ type: 'error', text: error || 'Fehler beim Löschen' });
                    }
                  }}
                  isLoading={isClearing}
                >
                  Endgültig löschen
                </LoadingButton>
              </ModalFooter>
            </Modal>
          )}
        </ModalTransition>
      </div>
    </div>
  );
}
