import { useApp } from '@/contexts/AppContext';
import { mockPolicies } from '@/lib/mockData';
import { SecurityPolicy } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Shield, FileWarning, Scale } from 'lucide-react';
import { useState } from 'react';

export const SystemSettings = () => {
  const { language } = useApp();
  const [policies, setPolicies] = useState<SecurityPolicy[]>(mockPolicies);

  const togglePolicy = (id: string) => {
    setPolicies(policies.map(p =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'file_restriction': return <FileWarning className="h-5 w-5" />;
      case 'size_limit': return <Scale className="h-5 w-5" />;
      case 'access_control': return <Shield className="h-5 w-5" />;
      default: return <Shield className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          {language === 'ru' ? 'Политики безопасности' :
           language === 'kz' ? 'Қауіпсіздік саясаттары' :
           'Security Policies'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === 'ru' ? 'Управление правилами безопасности и ограничениями системы' :
           language === 'kz' ? 'Қауіпсіздік ережелерін және жүйе шектеулерін басқару' :
           'Manage security rules and system restrictions'}
        </p>
      </div>

      <div className="grid gap-4">
        {policies.map(policy => (
          <Card key={policy.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getIcon(policy.type)}
                  <div>
                    <CardTitle className="text-base">{policy.name}</CardTitle>
                    <CardDescription>{policy.description}</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={policy.isActive}
                  onCheckedChange={() => togglePolicy(policy.id)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Badge variant={policy.isActive ? 'default' : 'secondary'}>
                {policy.isActive ? 'Активна' : 'Неактивна'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
