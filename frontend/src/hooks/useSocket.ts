import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number>(1);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user) return;

    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const SOCKET_URL =
      import.meta.env.VITE_SOCKET_URL || `${protocol}//${hostname}:5000`;

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setConnected(true);
      const lastSeen = localStorage.getItem('lastActivityTimestamp') || new Date(0).toISOString();
      socket.emit('activity:catch-up', lastSeen);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('presence:update', (data: { onlineCount: number }) => {
      setOnlineCount(data.onlineCount);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return { socket: socketRef.current, connected, onlineCount };
}
