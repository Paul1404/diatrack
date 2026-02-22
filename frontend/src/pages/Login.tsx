import { useState, useEffect } from 'react';
import Button from '@atlaskit/button/standard-button';
import LoadingButton from '@atlaskit/button/loading-button';
import Textfield from '@atlaskit/textfield';
import { login, register, checkRegistrationEnabled } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useAuth();

  useEffect(() => {
    checkRegistrationEnabled().then(({ data }) => {
      if (data) setRegistrationEnabled(data.enabled);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister && password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setIsLoading(true);

    const apiCall = isRegister ? register : login;
    const { data, error: apiError } = await apiCall(email, password);

    setIsLoading(false);

    if (data) {
      setUser(data);
    } else {
      setError(apiError || 'Ein Fehler ist aufgetreten');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <svg width="40" height="40" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="#0052CC"/>
              <path d="M50 15 C50 15 25 45 25 60 C25 75 36 85 50 85 C64 85 75 75 75 60 C75 45 50 15 50 15 Z" fill="white"/>
              <path d="M32 58 Q38 52 44 58 Q50 64 56 58 Q62 52 68 58" stroke="#0052CC" strokeWidth="4" fill="none" strokeLinecap="round"/>
            </svg>
            DiaTrack
          </div>
        </h1>

        <h2 style={{ textAlign: 'center', fontWeight: 'normal', marginBottom: '24px', fontSize: '16px', color: '#626F86' }}>
          {isRegister ? 'Neues Konto erstellen' : 'Bei DiaTrack anmelden'}
        </h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">E-Mail</label>
            <Textfield
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="name@beispiel.de"
              isRequired
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Passwort</label>
            <Textfield
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="••••••••"
              isRequired
            />
          </div>

          {isRegister && (
            <div className="form-field">
              <label htmlFor="confirmPassword">Passwort bestätigen</label>
              <Textfield
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword((e.target as HTMLInputElement).value)
                }
                placeholder="••••••••"
                isRequired
              />
            </div>
          )}

          <LoadingButton
            type="submit"
            appearance="primary"
            isLoading={isLoading}
            shouldFitContainer
          >
            {isRegister ? 'Registrieren' : 'Anmelden'}
          </LoadingButton>
        </form>

        {registrationEnabled && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Button
              appearance="subtle"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
            >
              {isRegister
                ? 'Bereits ein Konto? Anmelden'
                : 'Noch kein Konto? Registrieren'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
