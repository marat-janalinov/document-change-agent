import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Role, Language, User } from '@/types';
import { useAuth } from '@/hooks/useAuth';

interface AppContextType {
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentUser: User | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentRole, setCurrentRole] = useState<Role>('executive');
  const [language, setLanguage] = useState<Language>('ru');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  console.log('[AppContext] Рендер:', { 
    hasUser: !!user, 
    userRole: user?.role, 
    isAuthenticated, 
    isLoading,
    currentRole 
  });

  // Устанавливаем роль из пользователя, если он авторизован
  useEffect(() => {
    if (user && user.role) {
      console.log('[AppContext] Установка роли из пользователя:', user.role);
      setCurrentRole(user.role as Role);
    } else {
      console.log('[AppContext] Пользователь или роль отсутствуют:', { 
        user: user ? { id: user.id, username: user.username, role: user.role } : null, 
        hasRole: !!user?.role 
      });
      // Если пользователь есть, но роль не установлена, используем роль по умолчанию
      if (user && !user.role) {
        console.log('[AppContext] Роль не найдена у пользователя, используем executive по умолчанию');
        setCurrentRole('executive');
      }
    }
  }, [user]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        currentUser: user,
        language,
        setLanguage,
        theme,
        toggleTheme,
        isAuthenticated,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
