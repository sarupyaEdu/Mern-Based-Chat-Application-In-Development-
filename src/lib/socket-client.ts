import { io } from "socket.io-client";

const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : undefined);

export const socket = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true,
});
