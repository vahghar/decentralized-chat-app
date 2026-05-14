import React from 'react';
import { Message, useChatStore } from '../../store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatSocket } from '../../services/socket';
import { Trash2 } from 'lucide-react';

const MessageBubble: React.FC<{ message: Message; isOwn: boolean }> = ({ message, isOwn }) => {
  const { user, activeRoom } = useChatStore();
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isImg = /\.(jpeg|jpg|gif|png|webp)$/i.test(message.text ?? '');
  let isVoiceNote = false;
  let audioUrl = "";

  try {
    const parsed = JSON.parse(message.text);
    if (parsed.type === "voice") {
      isVoiceNote = true;
      audioUrl = parsed.audioData;
    }
  } catch (e) { }


  const toggleReaction = (emoji: string) => {
    if (!user) return;
    chatSocket.emit('add_reaction', {
      messageId: message.id,
      emoji,
      username: user.username,
      roomId: activeRoom
    });
  };

  const deleteMessage = () => {
    chatSocket.emit('delete_message', { messageId: message.id, roomId: activeRoom });
  };

  const QUICK_EMOJIS = ['👍', '❤️', '😂'];

  return (
    <div className={`flex flex-col anim ${isOwn ? 'items-end' : 'items-start'} group`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-fg">{isOwn ? 'You' : message.sender}</span>
        <span className="text-xs text-muted">{time}</span>
        {message.isP2P && (
          <span className="text-xs text-muted border border-border px-1 rounded">p2p</span>
        )}
      </div>

      <div className={`max-w-[75%] ${isOwn ? 'text-right' : 'text-left'}`}>
        {isImg ? (
          <img src={message.text} alt="img" className="max-w-full rounded" />
        ) : isVoiceNote ? (
          <div className={`p-1 rounded-full flex items-center ${isOwn ? 'bg-fg/10' : 'bg-surface'}`}>
            <audio controls src={audioUrl} className="h-8 max-w-[220px]" style={{ filter: 'grayscale(1) contrast(1.2)', outline: 'none' }} />
          </div>
        ) : (
          <div className="text-sm text-fg leading-relaxed prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Reactions Bar */}
      <div className={`flex flex-wrap gap-1 mt-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        {Object.entries(message.reactions || {}).map(([emoji, users]) => users.length > 0 && (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={`px-2 py-0.5 rounded-full border text-[10px] transition-colors ${users.includes(user?.username || '') ? 'border-fg bg-fg/10 text-fg' : 'border-border text-muted hover:border-muted'
              }`}
          >
            {emoji} {users.length}
          </button>
        ))}

        {/* Quick Picker (on hover) */}
        {!message.isP2P && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 ml-2">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className="hover:scale-125 transition-transform text-sm grayscale hover:grayscale-0"
              >
                {emoji}
              </button>
            ))}
            {isOwn && (
              <button 
                onClick={deleteMessage}
                className="text-muted hover:text-red-500 hover:scale-110 transition-all ml-1"
                title="Delete message"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
