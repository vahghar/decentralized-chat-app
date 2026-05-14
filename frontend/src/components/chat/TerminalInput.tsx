import React, { useState, useRef } from 'react';
import { Send, Mic, Square} from 'lucide-react';

interface Props { onSend: (text: string) => void; }

const TerminalInput: React.FC<Props> = ({ onSend }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) { onSend(text); setText(''); }
  };

  const startRecording = async () => {
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if(event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onSend(JSON.stringify({ type: 'voice', audioData: base64Audio }));
        }
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or failed", err);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
        type="button"
        onClick={isRecording ? stopRecording: startRecording}
        className={`transition-colors p-1.5 rounded-full ${isRecording ? 'bg-red-500/20 text-red-500' : 'text-fg hover:bg-surface'}`}
      >
        {isRecording ? <Square size={15} fill="currentColor" /> : <Mic size={15} />}
      </button>
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
