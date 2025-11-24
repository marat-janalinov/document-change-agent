import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/translations';
import { Chat } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Pin, MoreVertical, Pencil, Trash2, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatSidebarProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const ChatSidebar = ({ chats, selectedChat, onSelectChat, onNewChat, collapsed, onToggleCollapse }: ChatSidebarProps) => {
  const { language } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedChats = filteredChats.filter(c => c.isPinned);
  const regularChats = filteredChats.filter(c => !c.isPinned);
  const chatsWithFiles = filteredChats.filter(c => c.hasFiles);

  return (
    <div className={`relative border-r bg-card flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-80'}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-md hover:scale-110 transition-transform"
      >
        {collapsed ? '→' : '←'}
      </Button>

      {!collapsed && (
        <>
          <div className="p-4 border-b space-y-3">
            <Button onClick={onNewChat} className="w-full" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              {t('newChat', language)}
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search', language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-2">
              <TabsTrigger value="all" className="flex-1">{t('allChats', language)}</TabsTrigger>
              <TabsTrigger value="files" className="flex-1">{t('withFiles', language)}</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="all" className="m-0">
                {pinnedChats.length > 0 && (
                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{t('pinned', language)}</p>
                    {pinnedChats.map(chat => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isSelected={selectedChat?.id === chat.id}
                        onSelect={onSelectChat}
                      />
                    ))}
                  </div>
                )}

                <div className="px-4 py-2">
                  {regularChats.map(chat => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      isSelected={selectedChat?.id === chat.id}
                      onSelect={onSelectChat}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="files" className="m-0">
                <div className="px-4 py-2">
                  {chatsWithFiles.map(chat => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      isSelected={selectedChat?.id === chat.id}
                      onSelect={onSelectChat}
                    />
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </>
      )}

      {collapsed && (
        <div className="flex flex-col items-center py-4 space-y-4">
          <Button onClick={onNewChat} size="icon" variant="ghost" className="h-10 w-10">
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

interface ChatItemProps {
  chat: Chat;
  isSelected: boolean;
  onSelect: (chat: Chat) => void;
}

const ChatItem = ({ chat, isSelected, onSelect }: ChatItemProps) => {
  const { language } = useApp();

  return (
    <div
      onClick={() => onSelect(chat)}
      className={`
        group flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1
        transition-colors hover:bg-accent
        ${isSelected ? 'bg-accent' : ''}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {chat.isPinned && <Pin className="h-3 w-3 text-accent-foreground" />}
          {chat.hasFiles && <FileText className="h-3 w-3 text-muted-foreground" />}
          <h4 className="text-sm font-medium truncate">{chat.title}</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          {chat.messageCount} {language === 'en' ? 'messages' : 'сообщений'}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Pencil className="mr-2 h-4 w-4" />
            {t('rename', language)}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Pin className="mr-2 h-4 w-4" />
            {chat.isPinned ? t('unpin', language) : t('pin', language)}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            {t('delete', language)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
