# 04 · Real-time Contracts — Socket.io Event Inventory

> Frozen for 1:1 SignalR migration mapping.  
> Server: Socket.io 4.8.3 · Client: socket.io-client 4.8.3

## Connection Architecture

```
Client (web-app)
  └─ io(SOCKET_URL, { path: "/socket.io" })
       └─ Rooms:
            branch:<branchId>       ← room board, hostess assignments
            investor:<shareholderId> ← P&L live updates
```

## Client → Server Events

### Room Board

| Event | Payload | Description |
|---|---|---|
| `join_branch` | `{ branchId: string }` | Join branch room for real-time updates |
| `leave_branch` | `{ branchId: string }` | Leave branch room |

### Investor Dashboard

| Event | Payload | Description |
|---|---|---|
| `join_investor` | `{ shareholderId: string }` | Join investor room + receive `dashboard_summary` |
| `leave_investor` | `{ shareholderId: string }` | Leave investor room |

## Server → Client Events

### Room Board (`branch:<branchId>`)

| Event | Source | Payload Schema |
|---|---|---|
| `room_board_update` | `emitRoomUpdate()` in `rooms.ts` | `{ id, name, status, currentReservation?, ... }` |
| `room_table_status_changed` | `room-tables.ts` | `{ tableId, status, branchId, updatedAt }` |
| `error` | `rooms.ts` | `{ message: string }` |

### Hostess Assignments (`branch:<branchId>`)

| Event | Source | Trigger |
|---|---|---|
| `hostess:assigned` | `hostessAssignments.ts` | New hostess assigned to reservation |
| `hostess:extended` | `hostessAssignments.ts` | Hostess session time extended |
| `hostess:replaced` | `hostessAssignments.ts` | Hostess swapped during session |
| `hostess:time-extended` | `hostessAssignments.ts` | Additional time added |
| `hostess:session-closed` | `hostessAssignments.ts` | Session ended, commissions calculated |

**`hostess:assigned` payload:**
```typescript
{
  reservationId: string;
  hostessId: string;
  hostessName: string;
  branchId: string;
  assignedAt: string; // ISO 8601
}
```

**`hostess:session-closed` payload:**
```typescript
{
  sessionId: string;
  reservationId: string;
  branchId: string;
  hostessId: string;
  totalHours: number;
  commissionAmount: number;
  closedAt: string; // ISO 8601
}
```

### Investor Dashboard (`investor:<shareholderId>`)

| Event | Source | Payload Schema |
|---|---|---|
| `dashboard_summary` | `investor-socket.ts` | Full dashboard snapshot (on join) |
| `revenue_update` | `pnl-service.ts` | `{ branchId, orderNo, totalAmount, paymentMethod, updatedAt }` |
| `reservation_update` | `pnl-service.ts` | `{ branchId, reservationNo, status, roomName?, guestCount?, updatedAt }` |

**`revenue_update` payload:**
```typescript
{
  branchId: string;
  orderNo: string;
  totalAmount: number; // MYR
  paymentMethod: string;
  updatedAt: string; // ISO 8601
}
```

**`reservation_update` payload:**
```typescript
{
  branchId: string;
  reservationNo: string;
  status: string; // "confirmed" | "checked_in" | "checked_out" | "cancelled"
  roomName?: string;
  guestCount?: number;
  updatedAt: string; // ISO 8601
}
```

## Room Status State Machine

```
Available → Reserved → Checked-In (Occupied) → Cleaning → Available
Available → Maintenance → Available
Available → OOO (Out of Order)
```

Status values in DB: `available`, `reserved`, `occupied`, `cleaning`, `maintenance`, `out_of_order`

## Migration Notes for SignalR

| Socket.io Concept | SignalR Equivalent |
|---|---|
| `io.to(room).emit(event, payload)` | `Clients.Group(room).SendAsync(event, payload)` |
| `socket.join(room)` | `Groups.AddToGroupAsync(connectionId, room)` |
| `socket.on(event, handler)` | `hubConnection.on(event, handler)` |
| Transports: WebSocket + polling | WebSocket + Long Polling |
| `path: "/socket.io"` | Custom hub path (e.g. `/hubs/live`) |
