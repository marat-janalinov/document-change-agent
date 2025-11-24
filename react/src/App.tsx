import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AppProvider, useApp } from "@/contexts/AppContext";
import LoginVariant2 from "./pages/LoginVariant2";
import IndexVariant1 from "./pages/IndexVariant1";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useApp();

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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Компонент для редиректа после логина
const LoginRedirect = () => {
  const { isAuthenticated, isLoading, currentRole } = useApp();
  
  // Используем useEffect для отслеживания изменений состояния аутентификации
  useEffect(() => {
    console.log('[LoginRedirect] Состояние:', { isAuthenticated, isLoading, currentRole });
    if (!isLoading && isAuthenticated) {
      // Редирект на страницу в зависимости от роли
      let redirectPath = '/document-change-management';
      if (currentRole === 'admin') {
        redirectPath = '/admin';
      } else if (currentRole === 'security') {
        redirectPath = '/security';
      }
      console.log('[LoginRedirect] Выполняется редирект на', redirectPath);
      window.location.replace(redirectPath);
    }
  }, [isAuthenticated, isLoading, currentRole]);
  
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
  
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Перенаправление...</p>
        </div>
      </div>
    );
  }
  
  return <LoginVariant2 />;
};

const App = () => {
  console.log('[App] Компонент App рендерится');
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppProvider>
          <Routes>
              <Route path="/login" element={<LoginRedirect />} />
              <Route
                path="/document-change-management"
                element={
                  <ProtectedRoute>
                    <IndexVariant1 />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <IndexVariant1 />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/security"
                element={
                  <ProtectedRoute>
                    <IndexVariant1 />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/login" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AppProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
