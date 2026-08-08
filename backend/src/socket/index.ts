import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import {Group} from '../models/Group';
import http from 'http';

export const initializeSocket = async (server: http.Server) => {
  // using the base http server, we upgrade it here by attaching socket server to it
  const io = new SocketIOServer(server, {
    cors: {
      origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:5173'],
      credentials: true
    }
  });

  const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  // Clear ghost sockets from previous runs
  try {
    await pubClient.del('local_hub');
  } catch (e) {}

  // Chat Namespace for presence and fallback messaging
  const chatIo = io.of('/chat');
  chatIo.on('connection', (socket) => {
    console.log(`User connected to chat: ${socket.id}`);

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on('delete_message', async (data: { messageId: string, roomId: string }) => {
      try {
        const { Message } = await import('../models/Message');
        await Message.findByIdAndDelete(data.messageId);
        chatIo.to(data.roomId).emit('message_deleted', data.messageId);
      } catch (err) {
        console.error("Failed to delete message:", err);
      }
    });

    socket.on('create_group', async (data: { groupName: string }) => {
      try {
        const group = await Group.create({
          name: data.groupName,
        });
        chatIo.emit('group_created', group);
      } catch (err) {
        socket.emit('error','Could not create the group')
        console.error("Failed to create group:", err);
      }
    })

    socket.on('clear_room', async (roomId: string) => {
      try {
        const { Message } = await import('../models/Message');
        await Message.deleteMany({ roomId });
        chatIo.to(roomId).emit('room_cleared');
      } catch (err) {
        console.error("Failed to clear room:", err);
      }
    });

    socket.on('identify', async (username: string) => {
      socket.join(`user_${username}`);
      (socket as any).username = username;
      console.log(`User ${username} identified and joined personal room`);

      // Update presence
      const { User } = await import('../models/User');
      await User.findOneAndUpdate({ username }, { lastSeen: new Date() });
      chatIo.emit('presence_update', { username, online: true });
    });

    socket.on('send_invite', (data: { to: string, from: string }) => {
      socket.to(`user_${data.to}`).emit('receive_invite', { from: data.from });
    });

    socket.on('typing_start', (data: { roomId: string, username: string }) => {
      socket.to(data.roomId).emit('typing_start', { username: data.username });
    });

    socket.on('typing_stop', (data: { roomId: string, username: string }) => {
      socket.to(data.roomId).emit('typing_stop', { username: data.username });
    });

    socket.on('send_message', async (data: { roomId: string, message: any }) => {
      // Save to MongoDB (only non-P2P messages)
      const { Message } = await import('../models/Message');
      
      let expiresAt = undefined;
      if (data.roomId.startsWith('prox_')) {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      }

      const msg = await Message.create({
        roomId: data.roomId,
        sender: data.message.sender,
        text: data.message.text,
        isP2P: false,
        readBy: [data.message.sender],
        expiresAt
      });

      // Relay message via server
      socket.to(data.roomId).emit('receive_message', {
        ...data.message,
        id: msg._id,
        readBy: msg.readBy,
        reactions: {}
      });
    });

    socket.on('save_p2p_message', async (data: { roomId: string, message: any }) => {
      const { Message } = await import('../models/Message');
      await Message.create({
        roomId: data.roomId,
        sender: data.message.sender,
        text: data.message.text,
        isP2P: true,
        readBy: [data.message.sender] // Assume sender has read it
      });
      // Do NOT relay this message because it was sent via WebRTC P2P
    });


    socket.on('message_read', async (data: { messageId: string, roomId: string, username: string }) => {
      const { Message } = await import('../models/Message');
      const mongoose = (await import('mongoose')).default;

      if (!mongoose.Types.ObjectId.isValid(data.messageId)) return;

      const msg = await Message.findByIdAndUpdate(
        data.messageId,
        { $addToSet: { readBy: data.username } },
        { new: true }
      );
      if (msg) {
        chatIo.to(data.roomId).emit('read_receipt', { messageId: data.messageId, readBy: msg.readBy });
      }
    });

    socket.on('add_reaction', async (data: { messageId: string, emoji: string, username: string, roomId: string }) => {
      const { Message } = await import('../models/Message');
      const mongoose = (await import('mongoose')).default;

      if (!mongoose.Types.ObjectId.isValid(data.messageId)) return;

      const msg = await Message.findById(data.messageId);
      if (msg) {
        const reactions = msg.reactions as Map<string, string[]> || new Map();
        const users = reactions.get(data.emoji) || [];

        if (users.includes(data.username)) {
          reactions.set(data.emoji, users.filter(u => u !== data.username));
        } else {
          reactions.set(data.emoji, [...users, data.username]);
        }

        msg.reactions = reactions;
        await msg.save();

        chatIo.to(data.roomId).emit('reaction_update', {
          messageId: data.messageId,
          reactions: Object.fromEntries(reactions)
        });
      }
    });

    socket.on('disconnect', async () => {
      const username = (socket as any).username;
      if (username) {
        const { User } = await import('../models/User');
        await User.findOneAndUpdate({ username }, { lastSeen: new Date() });
        chatIo.emit('presence_update', { username, online: false });
      }
      console.log(`User disconnected from chat: ${socket.id}`);
    });
  });

  // Signaling Namespace for WebRTC
  const signalIo = io.of('/signal');
  signalIo.on('connection', (socket) => {
    console.log(`User connected to signal: ${socket.id}`);

    socket.on('join_community', (communityId: string) => {
      socket.join(communityId);
      console.log(`Socket ${socket.id} joined community ${communityId}`);
      // Tell everyone else in the community that a new peer joined
      socket.to(communityId).emit('peer_joined', { peerId: socket.id });
    });

    // --- LOCAL HUB GEO-TRACKING ---
    socket.on('join_local_hub', async (data: { lat: number, lon: number, radius?: number }) => {
      const radius = data.radius || 1000; // default 1000 meters
      try {
        // Store on socket for disconnect
        (socket as any).geoLoc = { lat: data.lat, lon: data.lon, radius };

        // Add to Redis GEO index
        await pubClient.geoAdd('local_hub', {
          longitude: data.lon,
          latitude: data.lat,
          member: socket.id
        });
        
        // Find peers in radius
        const peers = await pubClient.geoRadius('local_hub', {
          longitude: data.lon,
          latitude: data.lat,
        }, radius, 'm');

        // Filter out self
        const nearbyPeers = peers.filter((p: string) => p !== socket.id);
        socket.emit('peers_nearby', nearbyPeers);
        
        // Notify nearby peers that we joined
        nearbyPeers.forEach((peerId: string) => {
          socket.to(peerId).emit('peer_joined', { peerId: socket.id });
        });
      } catch (err) {
        console.error("Geo Redis Error:", err);
      }
    });

    // Targeted WebRTC Signaling
    socket.on('webrtc_offer', (data: { offer: any, targetPeerId?: string, roomId?: string }) => {
      if (data.roomId) {
        socket.to(data.roomId).emit('webrtc_offer', data.offer);
      } else if (data.targetPeerId) {
        socket.to(data.targetPeerId).emit('webrtc_offer', { offer: data.offer, fromPeerId: socket.id });
      }
    });

    socket.on('webrtc_answer', (data: { answer: any, targetPeerId?: string, roomId?: string }) => {
      if (data.roomId) {
        socket.to(data.roomId).emit('webrtc_answer', data.answer);
      } else if (data.targetPeerId) {
        socket.to(data.targetPeerId).emit('webrtc_answer', { answer: data.answer, fromPeerId: socket.id });
      }
    });

    socket.on('webrtc_ice_candidate', (data: { candidate: any, targetPeerId?: string, roomId?: string }) => {
      if (data.roomId) {
        socket.to(data.roomId).emit('webrtc_ice_candidate', data.candidate);
      } else if (data.targetPeerId) {
        socket.to(data.targetPeerId).emit('webrtc_ice_candidate', { candidate: data.candidate, fromPeerId: socket.id });
      }
    });

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined signal room ${roomId}`);
      // Notify others in the room to initiate connection
      socket.to(roomId).emit('ready_for_webrtc');
    });

    socket.on('disconnecting', async () => {
      try {
        // Remove from GEO index
        await pubClient.zRem('local_hub', socket.id);
        
        const loc = (socket as any).geoLoc;
        if (loc) {
          const peers = await pubClient.geoRadius('local_hub', {
            longitude: loc.lon,
            latitude: loc.lat,
          }, loc.radius, 'm');
          
          peers.forEach((peerId: string) => {
            if (peerId !== socket.id) {
              socket.to(peerId).emit('peer_left', { peerId: socket.id });
            }
          });
        }
      } catch (e) {}

      // Notify rooms that this peer is leaving
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit('peer_left', { peerId: socket.id });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from signal: ${socket.id}`);
    });
  });

  console.log('Socket.io and Redis Adapter initialized');
  return io;
};
