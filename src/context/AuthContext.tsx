import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { apiRequest, setCurrentUserId } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  users: User[];
  isSuperadmin: boolean;
  isLoading: boolean;
  switchUser: (user: User) => void;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  users: [],
  isSuperadmin: false,
  isLoading: true,
  switchUser: () => {},
  refreshUsers: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const data = await apiRequest<{ users: User[] }>('/api/auth/users');
      setUsers(data.users || []);

      // If no active user selected yet, default to first user (Superadmin)
      if (!user && data.users?.length > 0) {
        const defaultUser = data.users.find(u => u.role === 'Superadmin') || data.users[0];
        setUser(defaultUser);
        setCurrentUserId(defaultUser.id);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const switchUser = (selectedUser: User) => {
    setUser(selectedUser);
    setCurrentUserId(selectedUser.id);
  };

  const isSuperadmin = user?.role === 'Superadmin';

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        isSuperadmin,
        isLoading,
        switchUser,
        refreshUsers: fetchUsers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
