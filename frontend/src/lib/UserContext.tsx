'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser } from '@reachinbox/types';
import { fetchApi } from './api';
import { useRouter } from 'next/navigation';

interface UserContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true); // starts TRUE
  const router = useRouter();

  useEffect(() => {
    fetchApi('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
        router.replace('/login'); // redirect happens here
      });
  }, [router]);

  const logout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setUser(null);
      // Clear any cached state
      window.location.href = '/login'; // hard redirect, not router.push
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
