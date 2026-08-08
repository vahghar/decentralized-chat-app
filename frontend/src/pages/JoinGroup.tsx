import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { useChatStore } from '../store';
import toast from 'react-hot-toast';

const JoinGroup: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addGroup, setActiveRoom } = useChatStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const join = async () => {
      try {
        const response = await axios.post(`${API_URL}/api/users/join-group`, { groupId: id }, { withCredentials: true });
        toast.success(response.data.message || 'Joined group!');
        if (response.data.group) {
          addGroup({ id: response.data.group.id, name: response.data.group.name });
          setActiveRoom(response.data.group.id);
        }
        navigate('/chat');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to join group.');
      }
    };
    if (id) join();
  }, [id, navigate, addGroup, setActiveRoom]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-fg">
        <div className="bg-surface p-8 border border-border text-center max-w-sm">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/chat')}
            className="px-4 py-2 text-sm transition-colors"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            Go to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg text-fg">
      <div className="mono text-sm text-muted animate-pulse">Joining group...</div>
    </div>
  );
};

export default JoinGroup;
