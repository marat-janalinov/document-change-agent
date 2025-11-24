import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IDFLogo } from '@/components/layout/IDFLogo';
import industrialBg from '@/assets/industrial-bg-2.jpg';
import { Shield, Lock, User } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const LoginVariant2 = () => {
  const [language, setLanguage] = useState('ru');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error('Введите логин и пароль');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[Login] Начало процесса логина');
      const response = await login(username, password);
      console.log('[Login] Логин успешен, ответ:', response);
      
      // Проверяем, что токен сохранен
      const token = localStorage.getItem('auth_token');
      console.log('[Login] Токен в localStorage:', token ? `${token.substring(0, 20)}...` : 'НЕТ');
      
      if (!token) {
        throw new Error('Не удалось сохранить токен');
      }
      
      toast.success('Вход выполнен успешно');
      
      // Редирект на страницу в зависимости от роли пользователя
      const userRole = response.user?.role || 'executive';
      let redirectPath = '/document-change-management';
      
      if (userRole === 'admin') {
        redirectPath = '/admin';
      } else if (userRole === 'security') {
        redirectPath = '/security';
      } else {
        redirectPath = '/document-change-management';
      }
      
      console.log('[Login] Редирект на', redirectPath, 'для роли', userRole);
      setTimeout(() => {
        window.location.replace(redirectPath);
      }, 100);
    } catch (error: any) {
      console.error('[Login] Ошибка:', error);
      toast.error(error.message || 'Ошибка входа');
      setIsLoading(false);
    }
  };

  const translations = {
    kk: {
      title: 'Жүйеге кіру',
      subtitle: 'Қазақстанның өнеркәсіпті дамыту қоры',
      description: 'Жалғастыру үшін тіркелгі деректерін енгізіңіз',
      login: 'Логин',
      password: 'Құпия сөз',
      loginButton: 'Кіру',
      language: 'Тіл'
    },
    ru: {
      title: 'Вход в систему',
      subtitle: 'Фонд развития промышленности Республики Казахстан',
      description: 'Введите учетные данные для продолжения',
      login: 'Логин',
      password: 'Пароль',
      loginButton: 'Войти',
      language: 'Язык'
    },
    en: {
      title: 'System Login',
      subtitle: 'Industrial Development Fund of Kazakhstan',
      description: 'Enter your credentials to continue',
      login: 'Login',
      password: 'Password',
      loginButton: 'Sign In',
      language: 'Language'
    }
  };

  const t = translations[language as keyof typeof translations];

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gradient-to-br from-background via-secondary/5 to-primary/10">
      {/* Left side - Branding with glassmorphism */}
      <div className="hidden md:flex relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center animate-fade-in"
          style={{
            backgroundImage: `url(${industrialBg})`,
            filter: 'brightness(0.7) contrast(1.2)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-secondary/80 to-accent/70 backdrop-blur-sm" />

        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />

        <div className="relative z-10 h-full flex flex-col justify-center items-center px-12 text-primary-foreground">
          <div className="backdrop-blur-md bg-white/5 rounded-3xl p-8 border border-white/20 shadow-2xl animate-scale-in">
            <IDFLogo className="h-24 mb-6" language={language as 'ru' | 'kk' | 'en'} />
            <h1 className="text-3xl font-bold text-center mb-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {t.subtitle}
            </h1>
            <p className="text-lg text-center text-primary-foreground/90 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              Платформа управления и аналитики
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Form with glassmorphism */}
      <div className="flex items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${industrialBg})`, opacity: 0.05 }} />

        <div className="w-full max-w-md relative z-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="backdrop-blur-xl bg-card/80 rounded-3xl p-8 border border-border/50 shadow-2xl space-y-6">
            <div className="md:hidden flex justify-center mb-4">
              <IDFLogo className="h-16" language={language as 'ru' | 'kk' | 'en'} />
            </div>

            <div className="flex justify-end">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-36 border-primary/30 bg-background/50 backdrop-blur-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kk">Қазақша</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t.title}
              </h2>
              <p className="text-muted-foreground">{t.description}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login" className="text-foreground font-medium">{t.login}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login"
                    type="text"
                    placeholder={t.login}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="h-12 pl-10 border-2 border-border focus:border-primary transition-all duration-300 bg-background/50 backdrop-blur-sm rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">{t.password}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t.password}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="h-12 pl-10 border-2 border-border focus:border-primary transition-all duration-300 bg-background/50 backdrop-blur-sm rounded-xl"
                  />
                </div>
              </div>

              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] hover:bg-right-bottom transition-all duration-500 text-lg font-semibold shadow-lg rounded-xl"
                size="lg"
              >
                {isLoading ? 'Вход...' : t.loginButton}
              </Button>
            </div>

            <div className="text-center pt-2">
              <Link to="/">
                <Button variant="ghost" className="text-muted-foreground hover:text-primary transition-colors rounded-xl">
                  ← Вернуться к выбору вариантов
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginVariant2;
