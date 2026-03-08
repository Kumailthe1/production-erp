export type User = {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role: 'customer' | 'support';
  lastSeen?: string;
  status?: 'online' | 'offline' | 'away';
};

export type Message = {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  receiverId: string;
  read: boolean;
  image?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
};

export type Chat = {
  id: string;
  participants: User[];
  lastMessage: {
    content: string;
    timestamp: string;
    senderId: string;
    image?: string;
  };
  unreadCount: number;
};