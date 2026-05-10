import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

export const chatSocket: Socket = io(`${API_URL}/chat`, {
  autoConnect: false,
  withCredentials: true
});

export const signalSocket: Socket = io(`${API_URL}/signal`, {
  autoConnect: false,
  withCredentials: true
});
