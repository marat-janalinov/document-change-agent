import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/translations';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { ExplainabilityPanel } from './ExplainabilityPanel';
import { Chat, ChatMessage } from '@/types';
import { mockChats, mockMessages } from '@/lib/mockData';

export const ExecutiveChat = () => {
  const { language } = useApp();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(mockChats[0]);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleNewChat = () => {
    const newChat: Chat = {
      id: `c_${Date.now()}`,
      title: t('newChat', language),
      userId: 'u_001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
      hasFiles: false,
      messageCount: 0
    };
    setSelectedChat(newChat);
    setMessages([]);
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMessages(mockMessages.filter(m => m.chatId === chat.id));
  };

  const selectedMessage = messages.find(m => m.id === selectedMessageId);
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] w-full">
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar
          chats={mockChats}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <ChatArea
          chat={selectedChat}
          messages={messages}
          onMessageSelect={setSelectedMessageId}
        />
      </div>

      {hasMessages && (
        <ExplainabilityPanel
          message={selectedMessage}
          open={panelOpen}
          onToggleOpen={() => setPanelOpen(p => !p)}
        />
      )}
    </div>
  );
};
