import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const useGraffitiSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const [liveCursors, setLiveCursors] = useState({});
  const [drawingHistory, setDrawingHistory] = useState([]);

  // Initialize socket connection
  useEffect(() => {
    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    socketRef.current = io(BASE_URL, {
      transports: ['websocket', 'polling'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to graffiti server');
      setIsConnected(true);

      // Generate anonymous session ID
      const sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      socket.emit('join-graffiti', { sessionId });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from graffiti server');
      setIsConnected(false);
    });

    socket.on('user-count', (count) => {
      setActiveUsers(count);
    });

    socket.on('live-cursor', (data) => {
      setLiveCursors(prev => ({
        ...prev,
        [data.sessionId]: {
          x: data.x,
          y: data.y,
          color: data.color,
          timestamp: Date.now()
        }
      }));
    });

    socket.on('drawing-stroke', (strokeData) => {
      // Add stroke to drawing history for new users
      setDrawingHistory(prev => [...prev, strokeData]);
    });

    socket.on('canvas-history', (history) => {
      // Load existing drawing history for new users
      setDrawingHistory(history);
    });

    socket.on('clear-canvas', () => {
      setDrawingHistory([]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Send drawing stroke to server
  const sendDrawingStroke = useCallback((strokeData) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('drawing-stroke', strokeData);
    }
  }, [isConnected]);

  // Send cursor position
  const sendCursorPosition = useCallback((x, y, color) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('cursor-move', { x, y, color });
    }
  }, [isConnected]);

  // Send clear canvas event (disabled for collaborative preservation)
  const sendClearCanvas = useCallback(() => {
    console.log('Clear canvas disabled - preserving collaborative artwork');
  }, []);

  return {
    isConnected,
    activeUsers,
    liveCursors,
    drawingHistory,
    sendDrawingStroke,
    sendCursorPosition,
    sendClearCanvas
  };

  // Clean up old cursors (older than 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setLiveCursors(prev => {
        const filtered = {};
        Object.keys(prev).forEach(sessionId => {
          if (now - prev[sessionId].timestamp < 5000) {
            filtered[sessionId] = prev[sessionId];
          }
        });
        return filtered;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    activeUsers,
    liveCursors,
    drawingHistory,
    sendDrawingStroke,
    sendCursorPosition,
    sendClearCanvas
  };
};

export default useGraffitiSocket;
