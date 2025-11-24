import { useApp } from '@/contexts/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { HeaderVariant1 } from '@/components/layout/HeaderVariant1';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { SecurityPanel } from '@/components/security/SecurityPanel';
import DocumentChangeAgent from './DocumentChangeAgent';

const AppContent = () => {
  const { currentRole, isAuthenticated, isLoading, currentUser } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Редирект на правильную страницу в зависимости от роли
  useEffect(() => {
    if (!isLoading && isAuthenticated && currentRole) {
      const currentPath = location.pathname;
      let targetPath = '/document-change-management';
      
      if (currentRole === 'admin') {
        targetPath = '/admin';
      } else if (currentRole === 'security') {
        targetPath = '/security';
      } else {
        targetPath = '/document-change-management';
      }
      
      // Если пользователь на неправильной странице, редиректим
      if (currentPath !== targetPath && ['/document-change-management', '/admin', '/security'].includes(currentPath)) {
        console.log(`[IndexVariant1] Редирект с ${currentPath} на ${targetPath} для роли ${currentRole}`);
        navigate(targetPath, { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, currentRole, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Перенаправление на страницу входа...</p>
        </div>
      </div>
    );
  }

  const shouldShowDocumentChange = currentRole === 'executive' || currentRole === 'admin';
  const shouldShowSecurity = currentRole === 'security';
  const shouldShowAdmin = currentRole === 'admin' && location.pathname === '/admin';
  
  return (
    <div className="min-h-screen bg-background relative">
      <div className="relative z-10">
        {/* Для executive и admin показываем DocumentChangeAgent */}
        {shouldShowDocumentChange && !shouldShowAdmin && <DocumentChangeAgent />}
        
        {/* Для admin на странице /admin показываем AdminPanel */}
        {shouldShowAdmin && (
          <>
            <HeaderVariant1 />
            <div className="animate-scale-in overflow-hidden">
              <AdminPanel />
            </div>
          </>
        )}
        
        {/* Для security показываем SecurityPanel */}
        {shouldShowSecurity && (
          <>
            <HeaderVariant1 />
            <div className="animate-scale-in overflow-hidden">
              <SecurityPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const IndexVariant1 = () => {
  return <AppContent />;
};

export default IndexVariant1;
