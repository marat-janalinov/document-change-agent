import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/translations';
import { ChatMessage } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Quote, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ExplainabilityPanelProps {
  message: ChatMessage | undefined;
  open: boolean;
  onToggleOpen: () => void;
}

export const ExplainabilityPanel = ({ message, open, onToggleOpen }: ExplainabilityPanelProps) => {
  const { language } = useApp();

  if (!message || message.role !== 'assistant') {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={onToggleOpen}>
      <div className="border-t bg-card">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full h-12 flex items-center justify-between px-6 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span className="font-semibold">
                {language === 'ru' ? 'Источники и основания' :
                 language === 'kz' ? 'Көздер мен негіздер' :
                 'Sources and Rationale'}
              </span>
            </div>
            {open ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="max-w-7xl mx-auto px-6 pb-4">
            <Tabs defaultValue="sources" className="w-full">
              <TabsList>
                <TabsTrigger value="sources">
                  <FileText className="h-4 w-4 mr-2" />
                  {t('sources', language)}
                </TabsTrigger>
                <TabsTrigger value="metadata">
                  <Info className="h-4 w-4 mr-2" />
                  {t('metadata', language)}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sources" className="space-y-3">
                {message.sources && message.sources.length > 0 ? (
                  <ScrollArea className="h-48">
                    {message.sources.map(source => (
                      <div key={source.id} className="p-4 rounded-lg border bg-background mb-3">
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 text-primary mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-sm">{source.title}</h4>
                              {source.page && (
                                <Badge variant="secondary" className="text-xs">
                                  стр. {source.page}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{source.excerpt}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {language === 'ru' ? 'Нет доступных источников' : 'No sources available'}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="metadata" className="space-y-3">
                {message.metadata && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Версия данных</p>
                      <p className="font-semibold">{message.metadata.dataVersion}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Время обработки</p>
                      <p className="font-semibold">{message.metadata.processingTime}с</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Уверенность</p>
                      <p className="font-semibold">{(message.metadata.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
