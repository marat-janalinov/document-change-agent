import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/translations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersTable } from './UsersTable';
import { GlossaryTable } from './GlossaryTable';
import { PromptsTable } from './PromptsTable';
import { SystemSettings } from './SystemSettings';
import { Users, BookOpen, MessageSquare, Settings } from 'lucide-react';

export const AdminPanel = () => {
  const { language } = useApp();

  return (
    <div className="flex-1 bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('usersAndRoles', language)}
            </TabsTrigger>
            <TabsTrigger value="glossary" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('glossary', language)}
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('aiPrompts', language)}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('systemSettings', language)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersTable />
          </TabsContent>

          <TabsContent value="glossary">
            <GlossaryTable />
          </TabsContent>

          <TabsContent value="prompts">
            <PromptsTable />
          </TabsContent>

          <TabsContent value="settings">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
