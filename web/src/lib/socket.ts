// The live sea: other divers, and lights being released and answered.

import type { Light, LightSummary } from "./api";
import { motion } from "./motion";
import { formatDepth } from "./ocean";
import { useSea } from "./store";

type ServerEvent =
  | { type: "hello"; you: string; divers: Array<{ id: string; depth: number; x: number }> }
  | { type: "diver.moved"; diver: { id: string; depth: number; x: number } }
  | { type: "diver.left"; id: string }
  | { type: "light.released"; light: Light }
  | { type: "light.answered"; light: LightSummary }
  | { type: "light.hidden"; id: string };

function socketUrl() {
  const configured = process.env.NEXT_PUBLIC_SEA_SOCKET;
  if (configured) return configured;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.hostname}:8000/ws/sea`;
}

export function connectToSea(): () => void {
  let socket: WebSocket | null = null;
  let retry = 0;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSent = { depth: -1, x: -9, at: 0 };

  const sea = useSea.getState;

  function handle(event: ServerEvent) {
    switch (event.type) {
      case "hello":
        sea().setDivers(event.divers);
        break;
      case "diver.moved":
        sea().moveDiver(event.diver);
        break;
      case "diver.left":
        sea().removeDiver(event.id);
        break;
      case "light.released":
        sea().addLight(event.light);
        break;
      case "light.answered": {
        const before = sea().lights[event.light.id];
        // Flares only if this is news: an answer we made ourselves has already
        // flared when the request came back.
        sea().updateLight(event.light);
        if (before?.yours && event.light.answers > before.answers) {
          sea().say(`Someone answered your light at ${formatDepth(before.depth)}. It will glow a little longer.`);
        }
        break;
      }
      case "light.hidden":
        sea().removeLight(event.id);
        break;
    }
  }

  function open() {
    socket = new WebSocket(socketUrl());
    socket.onopen = () => {
      retry = 0;
      lastSent = { depth: -1, x: -9, at: 0 };
      sea().setConnected(true);
    };
    socket.onmessage = (message) => {
      try {
        handle(JSON.parse(message.data));
      } catch {
        // A malformed event is dropped; the next one will be fine.
      }
    };
    socket.onclose = () => {
      sea().setConnected(false);
      sea().setDivers([]);
      if (closed) return;
      retry = Math.min(retry + 1, 6);
      reconnectTimer = setTimeout(open, 500 * 2 ** retry);
    };
  }

  // Tell the others where we are: whenever we've moved, and every few seconds
  // regardless so we don't look like we've left.
  const heartbeat = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const t = performance.now();
    const x = Math.round(motion.pointer.x * 100) / 100;
    const moved = Math.abs(motion.depth - lastSent.depth) > 0.5 || Math.abs(x - lastSent.x) > 0.04;
    if (!moved && t - lastSent.at < 4000) return;
    socket.send(JSON.stringify({ type: "move", depth: Math.round(motion.depth * 10) / 10, x }));
    lastSent = { depth: motion.depth, x, at: t };
  }, 200);

  // Divers whose connection died without a goodbye fade out.
  const sweep = setInterval(() => {
    const t = performance.now() / 1000;
    for (const diver of Object.values(sea().divers)) {
      if (t - diver.seenAt > 15) sea().removeDiver(diver.id);
    }
  }, 5000);

  // Deferred a tick, so a mount that's immediately undone (React's development
  // double-render) never opens a socket only to close it mid-handshake.
  reconnectTimer = setTimeout(open, 0);

  return () => {
    closed = true;
    clearTimeout(reconnectTimer);
    clearInterval(heartbeat);
    clearInterval(sweep);
    socket?.close();
  };
}
