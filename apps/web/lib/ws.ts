'use client';
import { useEffect } from 'react';
import { useWorld } from './store';
import { WS_ENDPOINT } from './api';

export function useWorldStream() {
  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: number | undefined;

    function connect() {
      socket = new WebSocket(WS_ENDPOINT);
      socket.onopen = () => useWorld.getState().setConnected(true);
      socket.onclose = () => {
        useWorld.getState().setConnected(false);
        if (!cancelled) reconnectTimer = window.setTimeout(connect, 1500);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (msg) => {
        try {
          const e = JSON.parse(msg.data);
          if (e?.kind === 'hello') return;
          if (!e?.id || !e?.kind) return;
          useWorld.getState().applyEvent(e);
        } catch {
          // ignore
        }
      };
    }
    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);
}
