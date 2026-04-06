// useWebSocket.js
import { useState, useEffect, useCallback } from 'react';

const useWebSocket = (url) => {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const connect = useCallback(() => {
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastMessage(data);
    };

    socket.onclose = () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    setWs(socket);
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (ws) ws.close();
    };
  }, [connect]);

  return { isConnected, lastMessage };
};

export default useWebSocket;
