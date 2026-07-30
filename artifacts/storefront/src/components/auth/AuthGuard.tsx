import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

export function AuthGuard({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation('/account');
      } else if (requireAdmin && user.role !== 'admin') {
        setLocation('/account');
      }
    }
  }, [user, isLoading, setLocation, requireAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || (requireAdmin && user.role !== 'admin')) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
