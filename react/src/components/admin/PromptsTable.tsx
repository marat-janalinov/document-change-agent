import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/translations';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Pencil, Copy, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Prompt {
  filename: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
}

export const PromptsTable = () => {
  const { language } = useApp();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [formData, setFormData] = useState({
    filename: '',
    name: '',
    category: 'instruction_check',
    content: '',
  });

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getPrompts();
      setPrompts(data);
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить промпты',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPrompts = prompts.filter(prompt =>
    prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prompt.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setEditingPrompt(null);
    setFormData({
      filename: '',
      name: '',
      category: 'instruction_check',
      content: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      filename: prompt.filename,
      name: prompt.name,
      category: prompt.category,
      content: prompt.content, // Контент уже без заголовка из API
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingPrompt) {
        // При обновлении передаем только измененные поля
        await apiClient.updatePrompt(editingPrompt.filename, {
          name: formData.name,
          category: formData.category,
          content: formData.content,
        });
        toast({
          title: 'Успешно',
          description: 'Промпт обновлен и сохранен в markdown файл',
        });
      } else {
        if (!formData.filename) {
          toast({
            title: 'Ошибка',
            description: 'Укажите имя файла',
            variant: 'destructive',
          });
          return;
        }
        await apiClient.createPrompt(formData);
        toast({
          title: 'Успешно',
          description: 'Промпт создан',
        });
      }
      setIsDialogOpen(false);
      loadPrompts();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить промпт',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот промпт?')) {
      return;
    }
    try {
      await apiClient.deletePrompt(filename);
      toast({
        title: 'Успешно',
        description: 'Промпт удален',
      });
      loadPrompts();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить промпт',
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (prompt: Prompt) => {
    try {
      await apiClient.updatePrompt(prompt.filename, {
        is_active: !prompt.is_active,
      });
      loadPrompts();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить статус',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search', language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addPrompt', language)}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPrompt ? 'Редактировать промпт' : 'Создать новый промпт'}
              </DialogTitle>
              <DialogDescription>
                {editingPrompt ? 'Измените содержимое промпта' : 'Заполните форму для создания нового промпта'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="filename">Имя файла</Label>
                <Input
                  id="filename"
                  value={formData.filename}
                  onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
                  placeholder="instruction_check_system.md"
                  disabled={!!editingPrompt}
                />
              </div>
              <div>
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="System Prompt для проверки инструкций"
                />
              </div>
              <div>
                <Label htmlFor="category">Категория</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="instruction_check">Проверка инструкций</option>
                  <option value="change_application">Применение изменений</option>
                </select>
              </div>
              <div>
                <Label htmlFor="content">Содержимое</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Введите содержимое промпта..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSave}>
                {editingPrompt ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : filteredPrompts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Промпты не найдены
                </TableCell>
              </TableRow>
            ) : (
              filteredPrompts.map(prompt => (
                <TableRow key={prompt.filename}>
                  <TableCell className="font-medium">{prompt.name}</TableCell>
                  <TableCell className="max-w-md">
                    <ScrollArea className="h-20 w-full">
                      <div className="text-sm whitespace-pre-wrap font-mono">
                        {prompt.content.split('\n').map((line, idx) => (
                          <div key={idx} className="py-0.5">{line || '\u00A0'}</div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{prompt.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={prompt.is_active}
                      onCheckedChange={() => toggleActive(prompt)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(prompt)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(prompt.filename)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
