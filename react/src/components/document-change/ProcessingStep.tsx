import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { ChangeItem } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProcessingStepProps {
  progress: number;
  statusLog: Array<{ message: string; type: 'info' | 'success' | 'error' | 'warning' }>;
  changes: ChangeItem[];
}

export function ProcessingStep({ progress, statusLog, changes }: ProcessingStepProps) {
  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Прогресс обработки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Выполнено</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Статус выполнения</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 font-mono text-sm">
                {statusLog.map((log, index) => (
                  <div
                    key={index}
                    className={cn('flex items-start gap-2 py-1 border-b last:border-0', getLogColor(log.type))}
                  >
                    <span className="text-muted-foreground text-xs">
                      {new Date().toLocaleTimeString()}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Список изменений</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Изменения будут отображаться здесь по мере обработки
                  </p>
                ) : (
                  changes.map((change, index) => (
                    <div
                      key={index}
                      className={cn(
                        'p-3 rounded-lg border-l-4',
                        change.status === 'success'
                          ? 'bg-green-50 border-green-500 dark:bg-green-950/20'
                          : change.status === 'error'
                            ? 'bg-red-50 border-red-500 dark:bg-red-950/20'
                            : 'bg-gray-50 border-gray-300 dark:bg-gray-900/20'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(change.status)}
                          <span className="font-semibold text-sm">{change.change_id}</span>
                        </div>
                        <Badge
                          variant={
                            change.status === 'success'
                              ? 'default'
                              : change.status === 'error'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {change.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Операция: {change.operation}
                      </div>
                      {change.description && (
                        <div className="text-sm mt-1 break-words">{change.description}</div>
                      )}
                      {change.details && (
                        <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                          {typeof change.details === 'string'
                            ? change.details
                            : JSON.stringify(change.details, null, 2)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

