import { io, Socket } from 'socket.io-client';

export const chatSocket: Socket = io('http://localhost:5000/chat', {
  autoConnect: false,
  withCredentials: true
});

export const signalSocket: Socket = io('http://localhost:5000/signal', {
  autoConnect: false,
  withCredentials: true
});
