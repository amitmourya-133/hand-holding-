import { io } from 'socket.io-client';
import { getToken, API_ORIGIN } from './api.js';

let socket = null;

export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(API_ORIGIN || '/', {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect_error', () => {});
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
}
