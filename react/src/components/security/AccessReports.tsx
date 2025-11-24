import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export const AccessReports = () => {
  const { language } = useApp();

  const handleGenerateReport = () => {
    toast.success('Отчёт формируется', {
      description: 'Файл будет готов через несколько секунд'
    });
  };

  const roleStats = [
    { role: 'Руководитель', operations: 145, percentage: 48 },
    { role: 'Администратор', operations: 89, percentage: 30 },
    { role: 'Оператор ИБ', operations: 66, percentage: 22 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {language === 'ru' ? 'Статистика доступа' :
             language === 'kz' ? 'Қолжетімділік статистикасы' :
             'Access Statistics'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'ru' ? 'Анализ активности по ролям за последний месяц' :
             'Role activity analysis for the last month'}
          </p>
        </div>
        <Button onClick={handleGenerateReport}>
          <Download className="mr-2 h-4 w-4" />
          {t('generateReport', language)}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {roleStats.map(stat => (
          <Card key={stat.role}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{stat.role}</CardTitle>
              <CardDescription>Операций за месяц</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.operations}</div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span>{stat.percentage}% от общего числа</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Детализация по типам операций</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Загрузка файлов</span>
              <span className="font-semibold">127 операций</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Использование промптов</span>
              <span className="font-semibold">98 операций</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Управление пользователями</span>
              <span className="font-semibold">45 операций</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Вход в систему</span>
              <span className="font-semibold">30 операций</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
