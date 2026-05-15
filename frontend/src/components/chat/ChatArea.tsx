import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../store';
import MessageBubble from './MessageBubble';
import TerminalInput from './TerminalInput';
import { WebRTCManager } from '../../services/webrtc';
import { CryptoService } from '../../services/crypto';
import { chatSocket, signalSocket } from '../../services/socket';
import axios from 'axios';
import { API_URL } from '../../config';

import { Menu } from 'lucide-react';

interface Props { onToggleSidebar: () => void; }

const ChatArea: React.FC<Props> = ({ onToggleSidebar }) => {
  const { 
    activeRoom, messages, setMessages, addMessage, updateMessage, removeMessage,
    isP2PConnected, setIsP2PConnected, user, setOnlineUsers, updatePresence,
    identity, sharedSecrets, setSharedSecret, typingUsers, addTypingUser, removeTypingUser
  } = useChatStore();

  // On mobile, if the room changes, it's likely we just clicked something in the sidebar
  // The Sidebar itself will trigger onClose, but we also ensure ChatArea is clean.
  const [webrtc, setWebrtc] = useState<WebRTCManager | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/chat/history/${activeRoom}?t=${Date.now()}`, { 
          withCredentials: true,
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
        });
        const history = await Promise.all(res.data.map(async (msg: any) => {
          const secret = sharedSecrets[activeRoom];
          let decrypted = await CryptoService.decrypt(msg.text, secret || activeRoom);
          
          // Fallback: If we have a secret but decryption failed, it's likely a legacy message
          if (decrypted === "[Encrypted Message]" && secret) {
            decrypted = await CryptoService.decrypt(msg.text, activeRoom);
          }

          let text = decrypted;
          try {
            const parsed = JSON.parse(decrypted);
            text = parsed.text || decrypted;
          } catch (e) {}
          
          return {
            id: msg._id,
            text,
            sender: msg.sender,
            timestamp: msg.createdAt,
            isP2P: msg.isP2P,
            readBy: msg.readBy || [],
            reactions: msg.reactions || {},
          };
        }));
        setMessages(history);
      } catch (e) { console.error(e); }
    };

    const setupE2E = async () => {
      if (activeRoom.startsWith('dm_') && user && identity && !sharedSecrets[activeRoom]) {
        const parts = activeRoom.split('_');
        const otherUser = parts[1] === user.username ? parts[2] : parts[1];
        try {
          const res = await axios.get(`${API_URL}/api/users/public-key/${otherUser}`, { withCredentials: true });
          if (res.data.publicKey) {
            const pubKey = await CryptoService.importPublicKey(res.data.publicKey);
            const secret = await CryptoService.deriveSharedSecret(identity.privateKey, pubKey);
            setSharedSecret(activeRoom, secret);
          }
        } catch (e) { console.error("Key exchange failed", e); }
      }
    };

    const fetchAll = async () => {
      await setupE2E();
      fetchHistory();
    };
    fetchAll();

    const fetchOnline = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/online`, { withCredentials: true });
        setOnlineUsers(res.data);
      } catch (e) { console.error(e); }
    };
    fetchOnline();

    chatSocket.connect();
    signalSocket.connect();
    
    chatSocket.emit('join_room', activeRoom);
    if (user) chatSocket.emit('identify', user.username);

    const onMessage = async (msg: any) => {
      const secret = sharedSecrets[activeRoom];
      let decrypted = await CryptoService.decrypt(msg.text, secret || activeRoom);
      
      if (decrypted === "[Encrypted Message]" && secret) {
        decrypted = await CryptoService.decrypt(msg.text, activeRoom);
      }

      let text = decrypted;
      try {
        const parsed = JSON.parse(decrypted);
        text = parsed.text || decrypted;
      } catch (e) {}

      addMessage({ 
        id: msg.id || Math.random().toString(), 
        text, 
        sender: msg.sender, 
        timestamp: new Date(), 
        isP2P: false,
        readBy: msg.readBy || [msg.sender],
        reactions: msg.reactions || {},
      });
    };
    
    const onPresence = (data: { username: string, online: boolean }) => updatePresence(data.username, data.online);
    const onReadReceipt = (data: { messageId: string, readBy: string[] }) => updateMessage(data.messageId, { readBy: data.readBy });
    const onReaction = (data: { messageId: string, reactions: Record<string, string[]> }) => updateMessage(data.messageId, { reactions: data.reactions });

    chatSocket.on('receive_message', onMessage);
    chatSocket.on('presence_update', onPresence);
    chatSocket.on('read_receipt', onReadReceipt);
    chatSocket.on('reaction_update', onReaction);
    chatSocket.on('message_deleted', (messageId: string) => removeMessage(messageId));
    chatSocket.on('room_cleared', () => setMessages([]));
    chatSocket.on('typing_start', (data: { username: string }) => addTypingUser(data.username));
    chatSocket.on('typing_stop', (data: { username: string }) => removeTypingUser(data.username));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = entry.target.getAttribute('data-id');
          if (msgId && user && !msgId.startsWith('temp-')) {
            chatSocket.emit('message_read', { messageId: msgId, roomId: activeRoom, username: user.username });
            observer.unobserve(entry.target);
          }
        }
      });
    }, { threshold: 0.5 });

    // We'll apply this observer to each message in the render loop or via a ref-based system.
    // For simplicity, we can use a query selector inside an effect.
    const observeMessages = () => {
      document.querySelectorAll('.msg-bubble').forEach(el => observer.observe(el));
    };
    observeMessages();

    const manager = new WebRTCManager(
      activeRoom,
      async (enc) => {
        const dec = await CryptoService.decrypt(enc, sharedSecrets[activeRoom] || activeRoom);
        const p = JSON.parse(dec);
        addMessage({ 
          id: Math.random().toString(), 
          text: p.text, 
          sender: p.sender, 
          timestamp: new Date(), 
          isP2P: true,
          readBy: [],
          reactions: {},
        });
      },
      (status) => { setIsP2PConnected(status); }
    );
    setWebrtc(manager);

    return () => { 
      manager.close(); 
      observer.disconnect();
      chatSocket.off('receive_message'); 
      chatSocket.off('presence_update'); 
      chatSocket.off('read_receipt'); 
      chatSocket.off('reaction_update'); 
      chatSocket.off('message_deleted');
      chatSocket.off('room_cleared');
      chatSocket.off('typing_start');
      chatSocket.off('typing_stop');
      chatSocket.disconnect(); 
      signalSocket.disconnect();
    };
  }, [activeRoom, sharedSecrets[activeRoom], identity]); // re-run if secret or identity arrives

  const LOCKED = ['Announcements', 'Job openings'];
  const isLocked = LOCKED.includes(activeRoom) && !user?.isAdmin;

  const send = async (text: string) => {
    if (!user || isLocked) return;
    
    if (text.trim() === '/clear') {
      chatSocket.emit('clear_room', activeRoom);
      return;
    }

    let textToSend = text;

    if (text.toLowerCase().includes('/meme') && activeRoom === 'Memes') {
      try {
        const r = await axios.get('https://api.imgflip.com/get_memes');
        const memes = r.data.data.memes;
        textToSend = memes[Math.floor(Math.random() * memes.length)].url;
      } catch { return; }
    }

    const payload = JSON.stringify({ text: textToSend, sender: user.username });
    const enc = await CryptoService.encrypt(payload, sharedSecrets[activeRoom] || activeRoom);

    if (isP2PConnected && webrtc?.sendMessage(enc)) {
      addMessage({ 
        id: Math.random().toString(), 
        text: textToSend, 
        sender: user.username, 
        timestamp: new Date(), 
        isP2P: true,
        readBy: [],
        reactions: {},
      });
      // Save an encrypted backup to the server for history
      chatSocket.emit('save_p2p_message', {
        roomId: activeRoom,
        message: { text: enc, sender: user.username },
      });
      return;
    }

    chatSocket.emit('send_message', {
      roomId: activeRoom,
      message: { text: enc, sender: user.username },
    });
    // Optimistic UI — server will reply with actual ID but we add it locally first
    addMessage({ 
      id: 'temp-' + Math.random(), 
      text: textToSend, 
      sender: user.username, 
      timestamp: new Date(), 
      isP2P: false,
      readBy: [user.username],
      reactions: {},
    });
  };

  const roomLabel = () => {
    if (activeRoom.startsWith('dm_') && user) {
      const parts = activeRoom.split('_');
      return parts[1] === user.username ? parts[2] : parts[1];
    }
    if (activeRoom.startsWith('proximity_')) return 'Nearby';
    return activeRoom;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg" style={{ fontSize: 14 }}>

      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 md:px-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <button 
            onClick={onToggleSidebar}
            className="p-1 md:hidden text-muted hover:text-fg transition-colors"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-medium text-fg truncate">{roomLabel()}</span>
          {isLocked && <span className="text-xs text-muted border border-border px-1.5 py-0.5 rounded">Read only</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isP2PConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-dim'}`} />
          <span className="text-[10px] mono text-muted uppercase tracking-widest">{isP2PConnected ? 'P2P' : 'Relay'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-dim">No messages yet</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="msg-bubble" data-id={msg.id}>
              <MessageBubble message={msg} isOwn={msg.sender === user?.username} />
            </div>
          ))
        )}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-3 mt-2 mb-1 px-1">
            <span className="text-xs font-medium text-muted">{typingUsers.join(', ')}</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border bg-surface shrink-0">
        {isLocked
          ? <p className="text-xs text-muted text-center">You don't have permission to post here</p>
          : <TerminalInput onSend={send} activeRoom={activeRoom} />
        }
      </div>
    </div>
  );
};

export default ChatArea;
