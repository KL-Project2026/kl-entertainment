import type { Server as SocketServer, Namespace } from "socket.io";

// Socket.io namespace registry per OPERATIONS_WORKFLOW.md §1.3.
//
// The spec defines 4 namespaces, each with a distinct purpose:
//   /room-board → room status grid (room.status.changed, session.extended)
//   /pos        → POS, kitchen, hall (order.created, order.status.changed)
//   /manager    → manager dashboard alerts (session.alert, last-call.due)
//   /investor   → anonymized revenue ticks (revenue.tick)
//
// Existing emits use the default namespace ("/") + branch/investor rooms.
// They keep working untouched. NEW code paths SHOULD use the typed
// accessors below so namespace separation can be enforced over time.
//
// MIGRATION: .NET — SignalR hubs (RoomBoardHub, PosHub, ManagerHub,
// InvestorHub) map 1-to-1 to these namespaces.

export const NAMESPACE_PATHS = {
  ROOM_BOARD: "/room-board",
  POS:        "/pos",
  MANAGER:    "/manager",
  INVESTOR:   "/investor",
} as const;

export type NamespaceKey = keyof typeof NAMESPACE_PATHS;

interface NamespaceRegistry {
  roomBoard: Namespace;
  pos:       Namespace;
  manager:   Namespace;
  investor:  Namespace;
}

let registry: NamespaceRegistry | null = null;

export function initSocketNamespaces(io: SocketServer): NamespaceRegistry {
  registry = {
    roomBoard: io.of(NAMESPACE_PATHS.ROOM_BOARD),
    pos:       io.of(NAMESPACE_PATHS.POS),
    manager:   io.of(NAMESPACE_PATHS.MANAGER),
    investor:  io.of(NAMESPACE_PATHS.INVESTOR),
  };

  // Connection logging — useful while clients migrate from "/" to namespaces.
  registry.roomBoard.on("connection", (s) => console.log(`[ns/room-board] connected ${s.id}`));
  registry.pos.on("connection",       (s) => console.log(`[ns/pos] connected ${s.id}`));
  registry.manager.on("connection",   (s) => console.log(`[ns/manager] connected ${s.id}`));
  registry.investor.on("connection",  (s) => console.log(`[ns/investor] connected ${s.id}`));

  return registry;
}

export function getNamespaces(): NamespaceRegistry {
  if (!registry) {
    throw new Error("Socket namespaces not initialized. Call initSocketNamespaces(io) at startup.");
  }
  return registry;
}
