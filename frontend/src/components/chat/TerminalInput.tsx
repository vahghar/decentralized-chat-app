import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface Props { onSend: (text: string) => void; }

const TerminalInput: React.FC<Props> = ({ onSend }) => {
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) { onSend(text); setText(''); }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-3">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Message..."
        autoFocus
        className="flex-1 bg-transparent text-sm text-fg outline-none border-b border-border pb-1.5 focus:border-fg transition-colors"
        style={{ color: 'var(--text)' }}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className={`transition-opacity ${text.trim() ? 'opacity-100' : 'opacity-20'}`}
      >
        <Send size={15} className="text-fg" />
      </button>
    </form>
  );
};

export default TerminalInput;
