"use client";

import type { ClientToServerEvents, RealtimeRoom, ServerToClientEvents } from "@thread/types";
import type { Socket } from "socket.io-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SOCKET_URL } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
export { fallbackPollingInterval } from "./polling";

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RealtimeContextValue {
  readonly connected: boolean;
  readonly socket: RealtimeSocket | null;
  joinOrder(orderId: string): void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [socket, setSocket] = useState<RealtimeSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const requestedRooms = useRef(new Set<RealtimeRoom>());

  useEffect(() => {
    const accessToken = auth.accessToken;
    if (!accessToken) return;
    let active = true;
    let client: RealtimeSocket | undefined;
    void import("socket.io-client")
      .then(({ io }) => {
        if (!active) return;
        const socketUrl = new URL(SOCKET_URL);
        if (
          window.location.protocol === "https:" &&
          socketUrl.protocol !== "https:" &&
          socketUrl.protocol !== "wss:"
        )
          throw new Error("Secure pages require an HTTPS/WSS Socket.IO endpoint.");
        client = io(socketUrl.toString(), {
          auth: { token: accessToken },
          reconnection: true,
          reconnectionAttempts: Number.POSITIVE_INFINITY,
          reconnectionDelay: 1_000,
          reconnectionDelayMax: 10_000,
          transports: ["websocket", "polling"],
        });
        client.on("connect", () => {
          setConnected(true);
          for (const room of requestedRooms.current)
            client?.emit("room.join", room, () => undefined);
        });
        client.on("disconnect", () => setConnected(false));
        client.on("connect_error", () => setConnected(false));
        setSocket(client);
      })
      .catch(() => {
        if (active) setConnected(false);
      });
    return () => {
      active = false;
      client?.disconnect();
      setConnected(false);
      setSocket(null);
    };
  }, [auth.accessToken]);

  const joinOrder = useCallback(
    (orderId: string) => {
      const room = `order:${orderId}` as const;
      requestedRooms.current.add(room);
      if (socket?.connected) socket.emit("room.join", room, () => undefined);
    },
    [socket],
  );
  const value = useMemo(() => ({ connected, joinOrder, socket }), [connected, joinOrder, socket]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used inside RealtimeProvider");
  return context;
}
