import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiEvents } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

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

  const login = useCallback(async (email, password) => {
    try {
      const data = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('brightloop_token', data.access_token);
      localStorage.setItem('brightloop_user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      success(`Welcome back, ${data.user.full_name}!`);

      if (data.user.role === 'customer') {
        navigate('/portal/subscriptions');
      } else {
        navigate('/dashboard');
      }
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
      navigate('/portal/subscriptions');
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
    navigate('/login');
  }, [navigate, success]);

  const updateProfileState = useCallback((newUserData) => {
    setUser((prev) => {
      const updated = { ...prev, ...newUserData };
      localStorage.setItem('brightloop_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

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
