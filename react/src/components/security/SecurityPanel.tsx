import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OperationLogs } from '@/components/document-change/OperationLogs';
import { FileText, BarChart3 } from 'lucide-react';

export const SecurityPanel = () => {
  return (
    <div className="flex-1 bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="logs" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Логи операций
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Отчеты
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <OperationLogs />
          </TabsContent>

          <TabsContent value="reports">
            <div className="p-6 text-center text-muted-foreground">
              Раздел отчетов в разработке
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
