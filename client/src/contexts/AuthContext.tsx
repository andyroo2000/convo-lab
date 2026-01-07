import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { API_URL } from '../config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string, inviteCode: string) => Promise<void>;
  updateUser: (data: {
    displayName?: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    preferredStudyLanguage?: string;
    preferredNativeLanguage?: string;
    pinyinDisplayMode?: string;
    proficiencyLevel?: string;
    onboardingCompleted?: boolean;
    seenSampleContentGuide?: boolean;
    seenCustomContentGuide?: boolean;
  }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for existing session
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const userData = await response.json();
    setUser(userData);
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  };

  const signup = async (email: string, password: string, name: string, inviteCode: string) => {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name, inviteCode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.message || 'Signup failed');
    }

    const userData = await response.json();
    setUser(userData);
  };

  const updateUser = async (data: {
    displayName?: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    preferredStudyLanguage?: string;
    preferredNativeLanguage?: string;
    pinyinDisplayMode?: string;
    proficiencyLevel?: string;
    onboardingCompleted?: boolean;
    seenSampleContentGuide?: boolean;
    seenCustomContentGuide?: boolean;
  }) => {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Update failed');
    }

    const userData = await response.json();
    setUser(userData);
  };

  const deleteAccount = async () => {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Delete failed');
    }

    setUser(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.message || 'Password change failed');
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      signup,
      updateUser,
      deleteAccount,
      changePassword,
      refreshUser,
    }),
    // Functions are stable, only re-memoize when user/loading changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
