import React, { createContext, useContext, useEffect, useState } from "react";
import { User, useGetMe, useLogoutUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading: isQueryLoading } = useGetMe({
    query: {
      queryKey: ['/api/auth/me'],
      retry: false,
      staleTime: 5 * 60 * 1000,
    } as any,
  });

  const [localUser, setLocalUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const logoutMutation = useLogoutUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isQueryLoading) {
      setLocalUser(user || null);
      setIsInitializing(false);
    }
  }, [user, isQueryLoading]);

  const logout = () => {
    // Clear the UI immediately, then invalidate the server session cookie so a
    // refresh doesn't silently re-authenticate.
    setLocalUser(null);
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        queryClient.removeQueries();
      },
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user: localUser,
        isLoading: isInitializing || isQueryLoading,
        logout,
        setUser: setLocalUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
