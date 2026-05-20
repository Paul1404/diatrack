import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getMe, logout as apiLogout } from '../services/api';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error('[AuthContext] logout failed', err);
    }
    setUser(null);
  };

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const { data } = await getMe();
        if (cancelled) return;
        if (data) setUser(data);
      } catch (err) {
        console.error('[AuthContext] getMe threw unexpectedly', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      logout,
      isLoading,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
