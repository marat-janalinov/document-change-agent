import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Загрузка токена из localStorage при монтировании
  useEffect(() => {
    const loadAuth = async () => {
      const token = localStorage.getItem('auth_token');
      console.log('[useAuth] Загрузка токена при монтировании:', token ? `${token.substring(0, 20)}...` : 'НЕТ');
      
      if (token) {
        try {
          // Проверяем валидность токена
          console.log('[useAuth] Проверка токена через API...');
          const user = await apiClient.getCurrentUser(token);
          console.log('[useAuth] Токен валиден, пользователь:', user);
          setAuthState({
            user: user as User,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          console.log('[useAuth] Состояние обновлено: isAuthenticated=true, isLoading=false');
        } catch (error) {
          console.error('[useAuth] Ошибка проверки токена:', error);
          // Токен невалиден, удаляем его
          localStorage.removeItem('auth_token');
          setAuthState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          console.log('[useAuth] Состояние обновлено: isAuthenticated=false, isLoading=false');
        }
      } else {
        console.log('[useAuth] Токен не найден, пользователь не авторизован');
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };
    
    loadAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log('[useAuth] Начало логина для пользователя:', username);
      const response = await apiClient.login(username, password);
      console.log('[useAuth] Ответ от API получен:', response);
      
      // Сохраняем токен в localStorage
      localStorage.setItem('auth_token', response.access_token);
      console.log('[useAuth] Токен сохранен в localStorage');
      
      // Обновляем состояние синхронно
      const newState = {
        user: response.user as User,
        token: response.access_token,
        isAuthenticated: true,
        isLoading: false,
      };
      setAuthState(newState);
      console.log('[useAuth] Состояние обновлено, isAuthenticated:', newState.isAuthenticated);
      
      return response;
    } catch (error) {
      console.error('[useAuth] Ошибка при логине:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return {
    ...authState,
    login,
    logout,
  };
}

