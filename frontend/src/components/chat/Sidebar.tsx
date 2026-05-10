import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../store';
import axios from 'axios';
import toast from 'react-hot-toast';
import { chatSocket } from '../../services/socket';
import { MapPin, MapPinOff, Plus } from 'lucide-react';
import { API_URL } from '../../config';

// Round lat/lng to 2 decimal places (~1km grid) — must match backend formula
const roundCoord = (n: number) => Math.round(n * 100) / 100;

const Sidebar: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    user, setUser, activeRoom, setActiveRoom,
    contacts, setContacts, addContact, removeContactLocal,
    invites, setInvites, removeInvite,
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

  // Hold current coords for interval use
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch contacts on mount ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    axios.get(`${API_URL}/api/users/contacts`, { withCredentials: true })
      .then(r => { setContacts(r.data.contacts); setInvites(r.data.invites); })
      .catch(console.error);
  }, [user]);

  // ── Proximity: start / stop discovery when isDiscoverable changes ─
  useEffect(() => {
    if (!isDiscoverable) {
      // Stop everything
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      heartbeatRef.current = null;
      pollRef.current = null;
      coordsRef.current = null;

      // Tell backend we're no longer discoverable
      axios.post(`${API_URL}/api/users/status`,
        { lat: 0, lng: 0, isDiscoverable: false },
        { withCredentials: true }
      ).catch(() => {});

      // Leave the proximity socket room and redirect if currently in it
      const { activeRoom: currentRoom, proximityRoomId: currentProxRoom } = useChatStore.getState();
      if (currentProxRoom) {
        chatSocket.emit('leave_room', currentProxRoom);
      }
      if (currentRoom?.startsWith('proximity_')) {
        setActiveRoom('tech');
      }

      setNearbyUsers([]);
      setProximityRoomId(null);
      return;
    }

    // Request location
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

        const postStatus = () =>
          axios.post(`${API_URL}/api/users/status`,
            { lat, lng, isDiscoverable: true },
            { withCredentials: true }
          ).catch(console.error);

        const pollNearby = () =>
          axios.get(`${API_URL}/api/users/nearby?lat=${lat}&lng=${lng}`,
            { withCredentials: true }
          ).then(r => {
            setNearbyUsers(r.data.users ?? []);
            setProximityRoomId(r.data.roomId ?? null);
          }).catch(console.error);

        // Initial calls
        postStatus();
        pollNearby();

        // Start intervals
        heartbeatRef.current = setInterval(postStatus, 60_000);
        pollRef.current = setInterval(pollNearby, 30_000);
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
      if (pollRef.current) clearInterval(pollRef.current);
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
              <span>Join nearby room</span>
              <span className="text-xs text-muted ml-2">({nearbyUsers.length})</span>
            </button>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
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
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted truncate max-w-[110px]">{user?.username}</span>
          <button onClick={logout} className="text-xs text-muted hover:text-fg transition-colors">Logout</button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
