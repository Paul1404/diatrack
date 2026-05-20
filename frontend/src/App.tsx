import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { lazyWithRetry } from './lib/lazyWithRetry';

const Login = lazyWithRetry(() => import('./pages/Login'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Statistics = lazyWithRetry(() => import('./pages/Statistics'));
const History = lazyWithRetry(() => import('./pages/History'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));

function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--ds-background-neutral, #F1F2F4)',
        color: 'var(--ds-text, #172B4D)',
      }}
    >
      Laden...
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <PrivateRoute>
                <Layout>
                  <Statistics />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <Layout>
                  <History />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Layout>
                  <Settings />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
