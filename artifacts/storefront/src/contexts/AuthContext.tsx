import React, { createContext, useContext, useEffect, useState } from "react";
import { User, useGetMe } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading: isQueryLoading, refetch } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  const [localUser, setLocalUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!isQueryLoading) {
      setLocalUser(user || null);
      setIsInitializing(false);
    }
  }, [user, isQueryLoading]);

  const logout = () => {
    setLocalUser(null);
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
