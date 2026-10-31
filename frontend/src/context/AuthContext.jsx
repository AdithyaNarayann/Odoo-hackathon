import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiEvents } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function getRoleHome(role) {
  if (role === 'customer') {
    return '/subscriptions';
  }
  return '/dashboard';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('brightloop_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('brightloop_token'));
  const [loading, setLoading] = useState(true);

  const { success, error } = useToast();
  const navigate = useNavigate();

  // Validate session on load
  useEffect(() => {
    async function initAuth() {
      const savedToken = localStorage.getItem('brightloop_token');
      if (savedToken) {
        try {
          const profile = await api.get('/api/auth/me');
          setUser(profile);
          localStorage.setItem('brightloop_user', JSON.stringify(profile));
        } catch {
          // Token invalid or expired
          localStorage.removeItem('brightloop_token');
          localStorage.removeItem('brightloop_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  // Listen to global 401 unauthorized
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    apiEvents.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => apiEvents.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (email, password, from = null) => {
    try {
      const data = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('brightloop_token', data.access_token);
      localStorage.setItem('brightloop_user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      success(`Welcome back, ${data.user.full_name}!`);

      const targetPath = from || getRoleHome(data.user.role);
      navigate(targetPath, { replace: true });
      return data;
    } catch (err) {
      error(err.detail || 'Failed to log in. Please check your credentials.');
      throw err;
    }
  }, [navigate, success, error]);

  const signup = useCallback(async (signupData) => {
    try {
      const data = await api.post('/api/auth/signup', signupData);
      localStorage.setItem('brightloop_token', data.access_token);
      localStorage.setItem('brightloop_user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      success('Account created successfully!');
      const targetPath = getRoleHome(data.user.role);
      navigate(targetPath, { replace: true });
      return data;
    } catch (err) {
      throw err;
    }
  }, [navigate, success]);

  const logout = useCallback(() => {
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
    setUser(null);
    setToken(null);
    success('Logged out successfully.');
    navigate('/login', { replace: true });
  }, [navigate, success]);

  const updateProfileState = useCallback((newUserData) => {
    setUser((prev) => {
      const updated = { ...prev, ...newUserData };
      localStorage.setItem('brightloop_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-8 font-inter">
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-8 shadow-neo max-w-sm w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[4px] border-2 border-ink bg-brand-orange text-white shadow-neo font-anton text-2xl mb-1">
            BL
          </div>
          <div className="font-anton text-2xl uppercase tracking-wider text-ink">Brightloop</div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="w-5 h-5 border-2 border-ink border-t-brand-orange rounded-full animate-spin" />
            <p className="font-bold text-ink text-sm">Loading Brightloop...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(token && user),
        role: user?.role,
        login,
        signup,
        logout,
        updateProfileState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
