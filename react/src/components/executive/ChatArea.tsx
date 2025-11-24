import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/translations';
import { Chat, ChatMessage, FileAttachment } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MessageSquare, Paperclip, Send, Copy, RefreshCw, FileText, CheckCheck } from 'lucide-react';

interface ChatAreaProps {
  chat: Chat | null;
  messages: ChatMessage[];
  onMessageSelect: (messageId: string) => void;
}

export const ChatArea = ({ chat, messages, onMessageSelect }: ChatAreaProps) => {
  const { language } = useApp();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    console.log('Sending message:', input, attachments);
    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
        <div className="text-center space-y-4">
          <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground max-w-md">
            {t('noChats', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="h-14 border-b px-6 flex items-center bg-card">
        <h2 className="font-semibold">{chat.title}</h2>
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              onClick={() => message.role === 'assistant' && onMessageSelect(message.id)}
              className={`
                flex gap-4
                ${message.role === 'assistant' ? 'cursor-pointer hover:bg-accent/50 rounded-lg -mx-4 px-4 py-2' : ''}
              `}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}
              `}>
                {message.role === 'user' ? 'U' : 'AI'}
              </div>

              <div className="flex-1 space-y-2">
                <div className="prose prose-sm max-w-none">
                  {message.content.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="font-semibold mb-2">{line.slice(2, -2)}</p>;
                    }
                    if (line.startsWith('✓') || line.startsWith('✗')) {
                      return <p key={i} className="flex items-center gap-2">{line}</p>;
                    }
                    if (line.match(/^\d+\./)) {
                      return <p key={i} className="ml-4">{line}</p>;
                    }
                    return line ? <p key={i}>{line}</p> : <br key={i} />;
                  })}
                </div>

                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.attachments.map(file => (
                      <FileAttachmentCard key={file.id} file={file} />
                    ))}
                  </div>
                )}

                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="ghost" size="sm">
                      <Copy className="h-3 w-3 mr-1" />
                      Копировать
                    </Button>
                    <Button variant="ghost" size="sm">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Перегенерировать
                    </Button>
                    {message.metadata && (
                      <Badge variant="secondary" className="text-xs">
                        {message.metadata.dataVersion}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map(file => (
                <FileAttachmentCard key={file.id} file={file} />
              ))}
            </div>
          )}

          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chatPlaceholder', language)}
              className="min-h-[60px] pr-24 resize-none"
            />
            <div className="absolute right-2 bottom-2 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const mockFile: FileAttachment = {
                    id: `f_${Date.now()}`,
                    name: 'document.pdf',
                    type: 'application/pdf',
                    size: 1234567,
                    status: 'uploading',
                    progress: 45
                  };
                  setAttachments([...attachments, mockFile]);
                }}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button onClick={handleSend} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Enter — {t('send', language)} • Shift+Enter — новая строка
          </p>
        </div>
      </div>
    </div>
  );
};

const FileAttachmentCard = ({ file }: { file: FileAttachment }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg border">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        {file.status === 'uploading' && file.progress !== undefined && (
          <Progress value={file.progress} className="h-1 mt-1" />
        )}
        {file.status === 'done' && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCheck className="h-3 w-3" /> Обработан
          </p>
        )}
      </div>
    </div>
  );
};
