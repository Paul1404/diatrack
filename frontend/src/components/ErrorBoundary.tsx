import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

const CHUNK_LOAD_KEYWORDS = [
  'ChunkLoadError',
  'Loading chunk',
  'Loading CSS chunk',
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
];

const RELOAD_FLAG = 'diatrack.chunk-reloaded';

function isChunkLoadError(error: Error): boolean {
  if (!error) return false;
  const message = (error.message || '') + ' ' + (error.name || '');
  return CHUNK_LOAD_KEYWORDS.some((kw) => message.includes(kw));
}

function defaultFallback(error: Error, reset: () => void) {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--ds-background-neutral, #F1F2F4)',
        color: 'var(--ds-text, #172B4D)',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          width: '100%',
          background: 'var(--ds-surface, #FFFFFF)',
          padding: '32px 28px',
          borderRadius: '8px',
          boxShadow:
            '0 1px 1px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 600 }}>
          Etwas ist schiefgelaufen
        </h1>
        <p
          style={{
            margin: '0 0 24px',
            color: 'var(--ds-text-subtle, #626F86)',
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          Die App konnte nicht geladen werden. Bitte versuche es erneut.
        </p>
        {error?.message ? (
          <pre
            style={{
              textAlign: 'left',
              background: 'var(--ds-background-neutral-subtle, #F7F8F9)',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '120px',
              margin: '0 0 20px',
              color: 'var(--ds-text-subtle, #626F86)',
            }}
          >
            {error.message}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            background: '#0052CC',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '3px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          App neu laden
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Chunk load errors usually mean the user has a stale index.html
    // pointing to bundle files that no longer exist after a redeploy.
    // Force a hard reload once, with a sentinel to prevent reload loops.
    if (isChunkLoadError(error)) {
      try {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage may be unavailable (private mode); fall through.
      }
    }

    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
  }

  reset = () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const fallback = this.props.fallback ?? defaultFallback;
      return fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
