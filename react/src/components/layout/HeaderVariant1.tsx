import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Moon, Sun, LogOut } from 'lucide-react';
import { IDFLogo } from '@/components/layout/IDFLogo';

export const HeaderVariant1 = () => {
  const { language, setLanguage, theme, toggleTheme, currentUser } = useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-28 border-b border-primary/20 bg-primary text-primary-foreground animate-fade-in" style={{ boxShadow: 'var(--shadow-elevated)' }}>
      <div className="container mx-auto flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-3 hover-scale min-w-0">
          <IDFLogo className="h-16 md:h-20" language={language as 'ru' | 'kk' | 'en'} />
        </div>

        <div className="flex items-center gap-3">
          {currentUser && (
            <span className="text-sm text-primary-foreground/80 hidden md:block">
              {currentUser.email}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
            className="text-primary-foreground hover:bg-secondary/80 font-medium"
          >
            {language.toUpperCase()}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-primary-foreground hover:bg-secondary/80"
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-secondary/80 font-medium"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Выход
          </Button>
        </div>
      </div>
    </header>
  );
};
