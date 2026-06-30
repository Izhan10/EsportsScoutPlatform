import { API_URL } from './api.js';

let sharedSocket = null;

export function getSocket() {
  if (sharedSocket && sharedSocket.connected) return sharedSocket;
  const token = localStorage.getItem('token');
  if (!token || typeof io === 'undefined') return null;
  sharedSocket = io(API_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });
  return sharedSocket;
}

export function disconnectSocket() {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}
