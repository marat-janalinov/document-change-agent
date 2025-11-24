import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, FileText, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function FileManagement() {
  const [sourceFiles, setSourceFiles] = useState<string[]>([]);
  const [changesFiles, setChangesFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ filename: string; type: 'source' | 'changes' } | null>(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const [sourceData, changesData] = await Promise.all([
        apiClient.getFiles('source'),
        apiClient.getFiles('changes'),
      ]);
      setSourceFiles(sourceData.uploads || []);
      setChangesFiles(changesData.uploads || []);
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить список файлов',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDeleteClick = (filename: string, type: 'source' | 'changes') => {
    setFileToDelete({ filename, type });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    try {
      await apiClient.deleteFile(fileToDelete.filename, fileToDelete.type);
      toast({
        title: 'Успешно',
        description: `Файл ${fileToDelete.filename} удален`,
      });
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      await fetchFiles();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить файл',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Управление файлами
          </CardTitle>
          <CardDescription>
            Управление файлами в ваших персональных директориях
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="source" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="source">Исходные файлы</TabsTrigger>
              <TabsTrigger value="changes">Файлы с инструкциями</TabsTrigger>
            </TabsList>

            <TabsContent value="source" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Файлы из папки <code className="px-1 py-0.5 bg-muted rounded">source/</code>
                </p>
                <Button variant="outline" size="sm" onClick={fetchFiles} disabled={isLoading}>
                  Обновить
                </Button>
              </div>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : sourceFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет файлов в папке source
                </div>
              ) : (
                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="p-4 space-y-2">
                    {sourceFiles.map((filename) => (
                      <div
                        key={filename}
                        className="flex items-center justify-between p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{filename}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(filename, 'source')}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="changes" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Файлы из папки <code className="px-1 py-0.5 bg-muted rounded">changes/</code>
                </p>
                <Button variant="outline" size="sm" onClick={fetchFiles} disabled={isLoading}>
                  Обновить
                </Button>
              </div>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : changesFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет файлов в папке changes
                </div>
              ) : (
                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="p-4 space-y-2">
                    {changesFiles.map((filename) => (
                      <div
                        key={filename}
                        className="flex items-center justify-between p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{filename}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(filename, 'changes')}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Подтверждение удаления
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить файл <strong>{fileToDelete?.filename}</strong>?
              <br />
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

