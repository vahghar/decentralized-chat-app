import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import http from 'http';

export const initializeSocket = async (server: http.Server) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  // Chat Namespace for presence and fallback messaging
  const chatIo = io.of('/chat');
  chatIo.on('connection', (socket) => {
    console.log(`User connected to chat: ${socket.id}`);

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
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

    socket.on('send_message', async (data: { roomId: string, message: any }) => {
      // Save to MongoDB (only non-P2P messages)
      const { Message } = await import('../models/Message');
      const msg = await Message.create({
        roomId: data.roomId,
        sender: data.message.sender,
        text: data.message.text,
        isP2P: false,
        readBy: [data.message.sender]
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

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      const clients = signalIo.adapter.rooms.get(roomId);
      if (clients && clients.size > 1) {
        socket.emit('ready_for_webrtc'); // tell second user to initiate offer
      }
    });

    socket.on('webrtc_offer', (data: { offer: any, roomId: string }) => {
      socket.to(data.roomId).emit('webrtc_offer', data.offer);
    });

    socket.on('webrtc_answer', (data: { answer: any, roomId: string }) => {
      socket.to(data.roomId).emit('webrtc_answer', data.answer);
    });

    socket.on('webrtc_ice_candidate', (data: { candidate: any, roomId: string }) => {
      socket.to(data.roomId).emit('webrtc_ice_candidate', data.candidate);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from signal: ${socket.id}`);
    });
  });

  console.log('Socket.io and Redis Adapter initialized');
  return io;
};
