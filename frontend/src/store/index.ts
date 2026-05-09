import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
  isP2P: boolean;
  readBy: string[];
  reactions: Record<string, string[]>;
}

interface ChatState {
  user: User | null;
  setUser: (user: User | null) => void;
  activeRoom: string;
  setActiveRoom: (room: string) => void;
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  contacts: string[];
  setContacts: (contacts: string[]) => void;
  addContact: (username: string) => void;
  removeContactLocal: (username: string) => void;
  invites: string[];
  setInvites: (invites: string[]) => void;
  addInvite: (username: string) => void;
  removeInvite: (username: string) => void;
  isP2PConnected: boolean;
  setIsP2PConnected: (status: boolean) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  // Presence
  onlineUsers: string[];
  setOnlineUsers: (users: string[]) => void;
  updatePresence: (username: string, online: boolean) => void;
  // E2E Identity
  identity: CryptoKeyPair | null;
  setIdentity: (id: CryptoKeyPair | null) => void;
  sharedSecrets: Record<string, CryptoKey>;
  setSharedSecret: (roomId: string, key: CryptoKey) => void;
  // Proximity
  isDiscoverable: boolean;
  toggleDiscoverable: () => void;
  nearbyUsers: string[];
  setNearbyUsers: (users: string[]) => void;
  proximityRoomId: string | null;
  setProximityRoomId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      activeRoom: 'general',
      setActiveRoom: (activeRoom) => set({ activeRoom, messages: [], isP2PConnected: false }),
      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
      updateMessage: (messageId, updates) => set((state) => ({
        messages: state.messages.map(m => m.id === messageId ? { ...m, ...updates } : m)
      })),
      contacts: [],
      setContacts: (contacts) => set({ contacts }),
      addContact: (username) => set((state) => ({ 
        contacts: state.contacts.includes(username) ? state.contacts : [...state.contacts, username] 
      })),
      removeContactLocal: (username) => set((state) => ({
        contacts: state.contacts.filter(c => c !== username)
      })),
      invites: [],
      setInvites: (invites) => set({ invites }),
      addInvite: (username) => set((state) => ({ 
        invites: state.invites.includes(username) ? state.invites : [...state.invites, username] 
      })),
      removeInvite: (username) => set((state) => ({ 
        invites: state.invites.filter(i => i !== username) 
      })),
      isP2PConnected: false,
      setIsP2PConnected: (isP2PConnected) => set({ isP2PConnected }),
      theme: 'dark',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      // Presence
      onlineUsers: [],
      setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
      updatePresence: (username, online) => set((state) => ({
        onlineUsers: online 
          ? (state.onlineUsers.includes(username) ? state.onlineUsers : [...state.onlineUsers, username])
          : state.onlineUsers.filter(u => u !== username)
      })),
      // E2E Identity
      identity: null,
      setIdentity: (identity) => set({ identity }),
      sharedSecrets: {},
      setSharedSecret: (roomId, key) => set((state) => ({ 
        sharedSecrets: { ...state.sharedSecrets, [roomId]: key } 
      })),
      // Proximity
      isDiscoverable: false,
      toggleDiscoverable: () => set((state) => ({ isDiscoverable: !state.isDiscoverable })),
      nearbyUsers: [],
      setNearbyUsers: (nearbyUsers) => set({ nearbyUsers }),
      proximityRoomId: null,
      setProximityRoomId: (proximityRoomId) => set({ proximityRoomId }),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({ user: state.user, activeRoom: state.activeRoom }),
    }
  )
);
