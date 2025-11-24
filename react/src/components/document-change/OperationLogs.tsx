import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileText, Search, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
// Форматирование даты без date-fns (упрощенная версия)
const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateString;
  }
};

interface OperationLog {
  id: number;
  operation_id: string;
  operation_type: string;
  user_id: number | null;
  username: string | null;
  source_filename: string | null;
  changes_filename: string | null;
  tokens_used: number;
  tokens_prompt: number;
  tokens_completion: number;
  total_changes: number;
  status: string;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export function OperationLogs() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [operationType, setOperationType] = useState<string>('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getOperationLogs({
        limit,
        offset,
        operation_type: operationType === 'all' ? undefined : operationType,
      });
      setLogs(response.logs);
      setTotal(response.total);
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить логи',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, operationType]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Завершено</Badge>;
      case 'failed':
        return <Badge variant="destructive">Ошибка</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">В процессе</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };


  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Логи операций
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Тип операции" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все операции</SelectItem>
                  <SelectItem value="check_instructions">Проверка инструкций</SelectItem>
                  <SelectItem value="process_documents">Применение изменений</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchLogs} disabled={isLoading} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Логи не найдены
            </div>
          ) : (
            <>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {logs.map((log) => (
                    <Card key={log.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <div>
                              <div className="font-semibold">
                                {log.operation_type === 'check_instructions' ? (
                                  <span className="flex items-center gap-2">
                                    <Search className="h-4 w-4" />
                                    Проверка инструкций
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Применение изменений
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {log.operation_id.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                          {getStatusBadge(log.status)}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <div className="text-muted-foreground">Пользователь</div>
                            <div className="font-medium">{log.username || '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Исходный файл</div>
                            <div className="font-medium truncate">{log.source_filename || '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Файл инструкций</div>
                            <div className="font-medium truncate">{log.changes_filename || '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Изменений</div>
                            <div className="font-medium">{log.total_changes}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <div className="text-muted-foreground">Токенов использовано</div>
                            <div className="font-medium">{log.tokens_used.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Токенов в промпте</div>
                            <div className="font-medium">{log.tokens_prompt.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Токенов в ответе</div>
                            <div className="font-medium">{log.tokens_completion.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Создано</div>
                            <div className="font-medium">{formatDate(log.created_at)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Завершено</div>
                            <div className="font-medium">{formatDate(log.completed_at)}</div>
                          </div>
                        </div>

                        {log.error_message && (
                          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                            <strong>Ошибка:</strong> {log.error_message}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              {/* Пагинация */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Показано {offset + 1}–{Math.min(offset + limit, total)} из {total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Назад
                  </Button>
                  <div className="text-sm">
                    Страница {currentPage} из {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total || isLoading}
                  >
                    Вперед
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

