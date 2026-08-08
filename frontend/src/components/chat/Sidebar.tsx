import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../store';
import axios from 'axios';
import toast from 'react-hot-toast';
import { chatSocket, signalSocket } from '../../services/socket';
import { MapPin, MapPinOff, Plus, Users, LogOut, Trash2 } from 'lucide-react';
import { API_URL } from '../../config';

// Round lat/lng to 2 decimal places (~1km grid) — must match backend formula
const roundCoord = (n: number) => Math.round(n * 100) / 100;

const Sidebar: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    user, setUser, activeRoom, setActiveRoom,
    contacts, setContacts, addContact, removeContactLocal,
    invites, setInvites, removeInvite,
    groups, setGroups, addGroup, removeGroup,
    isDiscoverable, toggleDiscoverable,
    nearbyUsers, setNearbyUsers,
    proximityRoomId, setProximityRoomId,
    onlineUsers
  } = useChatStore();

  const selectRoom = (room: string) => {
    setActiveRoom(room);
    if (onClose) onClose();
  };

  const [newContact, setNewContact] = React.useState('');
  const [showGroupModal, setShowGroupModal] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState('');

  // Hold current coords for interval use
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch contacts on mount ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    axios.get(`${API_URL}/api/users/contacts`, { withCredentials: true })
      .then(r => { setContacts(r.data.contacts); setInvites(r.data.invites); setGroups(r.data.groups || []); })
      .catch(console.error);
  }, [user]);

  // ── Proximity: start / stop discovery when isDiscoverable changes ─
  useEffect(() => {
    if (!isDiscoverable) {
      // Stop everything
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      coordsRef.current = null;

      // Tell socket we're no longer discoverable
      // (The backend disconnect handles zRem normally, but we can just disconnect signal temporarily or ignore)
      
      const { activeRoom: currentRoom, proximityRoomId: currentProxRoom } = useChatStore.getState();
      if (currentProxRoom) {
        chatSocket.emit('leave_room', currentProxRoom);
      }
      if (currentRoom?.startsWith('proximity_')) {
        setActiveRoom('General');
      }

      setNearbyUsers([]);
      setProximityRoomId(null);
      signalSocket.off('peers_nearby');
      signalSocket.off('peer_joined');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      toggleDiscoverable(); // flip back
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = roundCoord(pos.coords.latitude);
        const lng = roundCoord(pos.coords.longitude);
        coordsRef.current = { lat, lng };

        if (!signalSocket.connected) signalSocket.connect();

        const joinHub = () => {
          signalSocket.emit('join_local_hub', { lat, lon: lng, radius: 1000 });
        };
        joinHub();

        // Listen for peers
        signalSocket.on('peers_nearby', (peers: string[]) => {
           // Create a deterministic room ID based on our location grid
           const roomId = `proximity_${lat.toString().replace('.','_')}_${lng.toString().replace('.','_')}`;
           setNearbyUsers(peers);
           setProximityRoomId(roomId);
        });
        
        signalSocket.on('peer_joined', (data: { peerId: string }) => {
           const current = useChatStore.getState().nearbyUsers;
           setNearbyUsers(Array.from(new Set([...current, data.peerId])));
        });

        signalSocket.on('peer_left', (data: { peerId: string }) => {
           const current = useChatStore.getState().nearbyUsers;
           setNearbyUsers(current.filter(p => p !== data.peerId));
        });

        // Heartbeat to keep GEO index fresh
        heartbeatRef.current = setInterval(joinHub, 60_000);
      },
      (err) => {
        console.error(err);
        toast.error('Location access denied. Enable it in your browser settings.');
        toggleDiscoverable(); // flip back
      }
    );

    // Cleanup on unmount or toggle-off
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      signalSocket.off('peers_nearby');
      signalSocket.off('peer_joined');
    };
  }, [isDiscoverable]);

  // ── Leave proximity room when browser closes ──────────────────────
  useEffect(() => {
    const handleUnload = () => {
      const { proximityRoomId: proxRoom } = useChatStore.getState();
      if (proxRoom) {
        // Synchronous beacon so it fires even on page close
        navigator.sendBeacon(
          `${API_URL}/api/users/status`,
          JSON.stringify({ lat: 0, lng: 0, isDiscoverable: false })
        );
        chatSocket.emit('leave_room', proxRoom);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // ── Contact actions ──────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.trim() || !user) return;
    try {
      await axios.post(`${API_URL}/api/users/invite`, { targetUsername: newContact }, { withCredentials: true });
      chatSocket.emit('send_invite', { to: newContact, from: user.username });
      setNewContact('');
      toast.success('Invite sent');
    } catch { toast.error('Failed to send invite'); }
  };

  const handleCreateGroup = () => {
    setShowGroupModal(true);
    setNewGroupName('');
  };

  const submitCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const response = await axios.post(`${API_URL}/api/users/create-group`, { name: newGroupName }, { withCredentials: true });
      const inviteUrl = `localhost:5173${response.data.inviteLink}`;
      navigator.clipboard.writeText(inviteUrl).catch(() => {});
      toast.success(`Group created & link copied!`);
      addGroup({ id: response.data.group._id || response.data.group.id, name: response.data.group.name });
      setShowGroupModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create group");
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    try {
      await axios.post(`${API_URL}/api/users/leave-group`, { groupId }, { withCredentials: true });
      removeGroup(groupId);
      if (activeRoom === groupId) setActiveRoom('General');
      toast.success("Left group");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to leave group");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_URL}/api/users/delete-group/${groupId}`, { withCredentials: true });
      removeGroup(groupId);
      if (activeRoom === groupId) setActiveRoom('General');
      toast.success("Group deleted");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete group");
    }
  };

  const handleAccept = async (name: string) => {
    try {
      await axios.post(`${API_URL}/api/users/accept`, { targetUsername: name }, { withCredentials: true });
      addContact(name); removeInvite(name);
    } catch {}
  };

  const handleRemove = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await axios.post(`${API_URL}/api/users/remove`, { targetUsername: name }, { withCredentials: true });
      removeContactLocal(name);
      if (activeRoom.includes(name)) setActiveRoom('tech');
    } catch {}
  };

  const getDM = (target: string) =>
    user ? 'dm_' + [user.username, target].sort().join('_') : '';

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
      setUser(null);
    } catch (e) { console.error(e); }
  };

  const rooms = ['Announcements', 'Memes', 'General'];

  return (
    <div className="w-56 h-full flex flex-col bg-surface border-r border-border" style={{ fontSize: 13 }}>

      {/* Logo */}
      <div className="h-12 flex items-center px-5 border-b border-border shrink-0">
        <span className="mono text-sm font-medium text-fg tracking-wide">3P</span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7">

        {/* Pending Invites */}
        {invites.length > 0 && (
          <section className="anim">
            <p className="text-xs text-muted mb-2">Pending</p>
            {invites.map(inv => (
              <div key={inv} className="flex items-center justify-between py-1">
                <span className="text-sm text-fg">@{inv}</span>
                <button onClick={() => handleAccept(inv)}
                  className="text-xs text-muted hover:text-fg transition-colors">Accept</button>
              </div>
            ))}
          </section>
        )}

        {/* Channels */}
        <section>
          <p className="text-xs text-muted mb-2">Channels</p>
          {rooms.map(r => (
            <button key={r} onClick={() => selectRoom(r)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors mb-0.5 ${
                activeRoom === r ? 'bg-fg text-bg' : 'text-fg hover:bg-border'
              }`}>
              {r}
            </button>
          ))}
          {groups.length > 0 && (
             <div className="mt-2 border-t border-border pt-2">
                <p className="text-xs text-muted mb-2">Your Groups</p>
                {groups.map(g => (
                  <div key={g.id} className={`flex items-center w-full px-2 py-1.5 text-sm rounded transition-colors mb-0.5 group/groupItem ${
                      activeRoom === g.id ? 'bg-fg text-bg' : 'text-fg hover:bg-border'
                    }`}>
                    <button onClick={() => selectRoom(g.id)} className="flex-1 text-left truncate">
                      {g.name}
                    </button>
                    <div className="opacity-0 group-hover/groupItem:opacity-100 flex items-center shrink-0">
                      {g.creator === user?.username ? (
                         <button onClick={() => handleDeleteGroup(g.id)} title="Delete group">
                           <Trash2 size={13} className="text-red-500 hover:text-red-400" />
                         </button>
                      ) : (
                         <button onClick={() => handleLeaveGroup(g.id)} title="Leave group">
                           <LogOut size={13} className="text-red-500 hover:text-red-400" />
                         </button>
                      )}
                    </div>
                  </div>
                ))}
             </div>
          )}
        </section>

        {/* Peers */}
        <section>
          <p className="text-xs text-muted mb-2">Peers</p>
          {contacts.length === 0 && <p className="text-xs text-dim">No peers yet</p>}
          {contacts.map(c => {
            const room = getDM(c);
            const isOnline = onlineUsers.includes(c);
            return (
              <div key={c} className="group relative mb-0.5">
                <button onClick={() => selectRoom(room)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors flex items-center gap-2 ${
                    activeRoom === room ? 'bg-fg text-bg' : 'text-fg hover:bg-border'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-green-500' : 'bg-dim'}`} />
                  <span className="truncate">{c}</span>
                </button>
                <button onClick={e => handleRemove(e, c)}
                  className="absolute right-1.5 top-1.5 text-xs text-dim opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity">
                  ×
                </button>
              </div>
            );
          })}
        </section>

        {/* Nearby — always shown, toggle controls sharing */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted">Nearby</p>
            <button
              onClick={toggleDiscoverable}
              title={isDiscoverable ? 'Stop sharing location' : 'Share location'}
              className={`transition-colors ${isDiscoverable ? 'text-fg' : 'text-dim hover:text-muted'}`}
            >
              {isDiscoverable ? <MapPin size={12} /> : <MapPinOff size={12} />}
            </button>
          </div>

          {!isDiscoverable && (
            <p className="text-xs text-dim">Enable location to see nearby users</p>
          )}

          {isDiscoverable && nearbyUsers.length === 0 && (
            <p className="text-xs text-dim">No one nearby</p>
          )}

          {isDiscoverable && nearbyUsers.length > 0 && proximityRoomId && (
            <button
              onClick={() => selectRoom(proximityRoomId)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                activeRoom === proximityRoomId ? 'bg-fg text-bg' : 'text-fg hover:bg-border'
              }`}
            >
              <span>Join Local Hub</span>
              <span className="text-xs text-muted ml-2">({nearbyUsers.length})</span>
            </button>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
        <div className="flex flex-col gap-3">
          <form onSubmit={handleInvite} className="flex items-center gap-2 border-b border-border pb-1 focus-within:border-fg transition-colors">
            <button type="submit" title="Send invite" className="text-muted hover:text-fg transition-colors shrink-0"><Plus size={13} /></button>
            <input
              type="text"
              placeholder="Invite someone..."
              value={newContact}
              onChange={e => setNewContact(e.target.value)}
              style={{ color: 'var(--text)' }}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </form>
          <button 
            onClick={handleCreateGroup}
            className="w-full text-center px-2 py-1.5 text-sm rounded transition-colors flex items-center justify-center gap-2 text-fg hover:bg-border border border-border"
          >
            <Users size={14} />
            <span>Create Group</span>
          </button>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted truncate max-w-[110px]">{user?.username}</span>
          <button onClick={logout} className="text-xs text-muted hover:text-fg transition-colors">Logout</button>
        </div>
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-medium mb-4">Create Group</h3>
            <form onSubmit={submitCreateGroup}>
              <input
                type="text"
                autoFocus
                placeholder="Group name"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 text-sm outline-none focus:border-fg transition-colors mb-6"
                style={{ color: 'var(--text)' }}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-fg transition-colors border border-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm transition-opacity"
                  style={{ background: 'var(--text)', color: 'var(--bg)' }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
