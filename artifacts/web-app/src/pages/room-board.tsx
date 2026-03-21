import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import { useListBranches, getGetBranchRoomBoardQueryKey } from "@workspace/api-client-react";
import { Tabs, Card, Badge } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveTimer } from "@/hooks/use-live-timer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateRoomStatus } from "@workspace/api-client-react";
import { io } from "socket.io-client";
import { Clock, Users, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import type { UpdateRoomStatusRequestStatus } from "@workspace/api-client-react";

interface RoomEntry {
  id: string;
  name: string;
  roomType: string;
  capacityMin: number;
  capacityMax: number;
  hourlyRate: number | null;
  minHours: number;
  status: "available" | "occupied" | "cleaning" | "maintenance" | "blocked";
  sortOrder: number;
  isActive: boolean;
  description?: string;
  floorLevel?: string;
  reservationNo: string | null;
  guestName: string | null;
  guestCount: number | null;
  checkInTime: string | null;
  expectedCheckOut: string | null;
  reservationStatus: string | null;
}

interface BoardResponse {
  branchId: string;
  branchName: string;
  isLive: boolean;
  viewDate: string;
  roomTypes: string[];
  rooms: RoomEntry[];
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  available:   "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  occupied:    "bg-red-500/10 border-red-500/30 text-red-400",
  cleaning:    "bg-amber-500/10 border-amber-500/30 text-amber-400",
  maintenance: "bg-gray-500/10 border-gray-500/30 text-gray-400",
  blocked:     "bg-purple-500/10 border-purple-500/30 text-purple-400",
};

const STATUS_GLOWS: Record<string, string> = {
  available:   "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
  occupied:    "shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  cleaning:    "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
  maintenance: "shadow-none",
  blocked:     "shadow-none",
};

const RES_STATUS_COLORS: Record<string, string> = {
  tentative:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checked_in:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  extended:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  checked_out: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function LiveRoomCard({ room }: { room: RoomEntry }) {
  const timer = useLiveTimer(room.status === "occupied" ? room.checkInTime : null);
  const updateStatusMutation = useUpdateRoomStatus();

  const handleStatusChange = (newStatus: UpdateRoomStatusRequestStatus) => {
    updateStatusMutation.mutate({ id: room.id, data: { status: newStatus } });
  };

  return (
    <Card className={`flex flex-col relative overflow-hidden transition-all duration-300 hover:scale-[1.02] cursor-pointer ${STATUS_GLOWS[room.status] ?? ""}`}>
      <div className={`h-1.5 w-full ${(STATUS_COLORS[room.status] ?? "").split(" ")[0].replace("/10", "")}`} />

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-display text-2xl font-bold">{room.name}</h3>
          <Badge variant={room.roomType.includes("vip") ? "warning" : "neutral"} className="uppercase text-xs">
            {room.roomType.replace(/_/g, " ")}
          </Badge>
        </div>

        {room.status === "occupied" ? (
          <div className="flex-1 flex flex-col justify-center space-y-3 bg-black/20 p-3 rounded-lg border border-white/5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Guest</span>
              <span className="font-medium truncate max-w-[120px]">{room.guestName || "Walk-in"}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground"><Users className="w-4 h-4 inline mr-1" /> Pax</span>
              <span className="font-medium">{room.guestCount || room.capacityMin} / {room.capacityMax}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-white/5">
              <span className="text-primary font-bold flex items-center gap-1">
                <Clock className="w-4 h-4" /> {timer}
              </span>
              {room.expectedCheckOut && (
                <span className="text-xs text-muted-foreground">Until {formatTime(room.expectedCheckOut)}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <span className={`px-3 py-1 rounded-full text-xs uppercase font-bold tracking-wider border ${STATUS_COLORS[room.status] ?? ""}`}>
              {room.status}
            </span>
            <span className="text-muted-foreground text-sm mt-3">
              Cap: {room.capacityMin}–{room.capacityMax} pax
            </span>
          </div>
        )}
      </div>

      {/* Quick Action Overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10">
        {room.status === "available" && (
          <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded border border-red-500/30 text-sm font-medium hover:bg-red-500 hover:text-white transition-colors" onClick={() => handleStatusChange("occupied")}>
            Walk-in Check-in
          </button>
        )}
        {room.status === "occupied" && (
          <button className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 text-sm font-medium hover:bg-amber-500 hover:text-white transition-colors" onClick={() => handleStatusChange("cleaning")}>
            Check-out
          </button>
        )}
        {room.status === "cleaning" && (
          <button className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500 hover:text-white transition-colors" onClick={() => handleStatusChange("available")}>
            Mark Cleaned
          </button>
        )}
      </div>
    </Card>
  );
}

function DateRoomCard({ room }: { room: RoomEntry }) {
  const hasReservation = !!room.reservationNo;

  return (
    <Card className={`flex flex-col overflow-hidden transition-all duration-200 ${hasReservation ? "border-primary/20" : ""}`}>
      <div className={`h-1.5 w-full ${hasReservation ? "bg-primary/60" : "bg-white/5"}`} />

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-display text-2xl font-bold">{room.name}</h3>
          <Badge variant={room.roomType.includes("vip") ? "warning" : "neutral"} className="uppercase text-xs">
            {room.roomType.replace(/_/g, " ")}
          </Badge>
        </div>

        {hasReservation ? (
          <div className="flex-1 flex flex-col justify-center space-y-2.5 bg-black/20 p-3 rounded-lg border border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-primary/80">{room.reservationNo}</span>
              <Badge className={`text-xs border ${RES_STATUS_COLORS[room.reservationStatus ?? ""] ?? "bg-white/10 text-white border-white/20"}`}>
                {(room.reservationStatus ?? "").replace("_", " ")}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Guest</span>
              <span className="font-medium truncate max-w-[120px]">{room.guestName || "Walk-in"}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground"><Users className="w-4 h-4 inline mr-1" /> Pax</span>
              <span className="font-medium">{room.guestCount ?? "—"} / {room.capacityMax}</span>
            </div>
            {room.checkInTime && room.expectedCheckOut && (
              <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-white/5">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime(room.checkInTime)}</span>
                <span>→ {formatTime(room.expectedCheckOut)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2">
            <span className="px-3 py-1 rounded-full text-xs uppercase font-bold tracking-wider border bg-white/5 text-muted-foreground/50 border-white/10">
              No Booking
            </span>
            <span className="text-muted-foreground/50 text-xs">
              Cap: {room.capacityMin}–{room.capacityMax} pax
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function RoomBoard() {
  const { user, token } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(user?.branchId || null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [typeFilter, setTypeFilter] = useState("__all__");

  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  const { data: branchesData } = useListBranches();

  useEffect(() => {
    if (!selectedBranchId && branchesData?.data && branchesData.data.length > 0) {
      setSelectedBranchId(branchesData.data[0].id);
    }
  }, [branchesData, selectedBranchId]);

  const { data: boardData, isLoading } = useQuery<BoardResponse>({
    queryKey: [...getGetBranchRoomBoardQueryKey(selectedBranchId || ""), date],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      const res = await fetch(`/api/branches/${selectedBranchId}/room-board?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch room board");
      return res.json();
    },
    enabled: !!selectedBranchId,
  });

  // WebSocket (live only)
  useEffect(() => {
    if (!selectedBranchId || !isToday) return;

    const socket = io(window.location.origin, { path: "/socket.io" });

    socket.on("connect", () => {
      socket.emit("join_branch", { branchId: selectedBranchId });
    });

    socket.on("room_board_update", (updatedData) => {
      if (updatedData) {
        queryClient.setQueryData(
          [...getGetBranchRoomBoardQueryKey(selectedBranchId), date],
          updatedData
        );
      } else {
        queryClient.invalidateQueries({
          queryKey: [...getGetBranchRoomBoardQueryKey(selectedBranchId), date],
        });
      }
    });

    return () => { socket.disconnect(); };
  }, [selectedBranchId, isToday, date, queryClient]);

  const allRooms: RoomEntry[] = (boardData?.rooms ?? []) as RoomEntry[];
  const roomTypes: string[] = boardData?.roomTypes ?? [];

  const rooms = typeFilter === "__all__"
    ? allRooms
    : allRooms.filter((r) => r.roomType === typeFilter);

  const stats = {
    occupied:  allRooms.filter((r) => r.status === "occupied" || r.reservationStatus === "checked_in").length,
    available: allRooms.filter((r) => r.status === "available" && !r.reservationNo).length,
    booked:    allRooms.filter((r) => r.reservationNo && r.reservationStatus !== "checked_in").length,
    cleaning:  allRooms.filter((r) => r.status === "cleaning").length,
  };

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Top row: branch tabs + legend */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        {user?.role === "super_admin" && branchesData?.data ? (
          <Tabs
            tabs={branchesData.data.map((b) => ({ id: b.id, label: b.name }))}
            activeTab={selectedBranchId || ""}
            onChange={setSelectedBranchId}
          />
        ) : (
          <h2 className="text-xl font-display font-semibold text-primary">Live Board</h2>
        )}

        <div className="flex gap-3 text-xs font-medium bg-black/40 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
            Available
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#EF4444]" />
            Occupied
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#F59E0B]" />
            Cleaning
          </div>
          {!isToday && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/70" />
              Booked
            </div>
          )}
        </div>
      </div>

      {/* Filters row: date navigator + type filter */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Date navigator */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-1 py-1">
          <button
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <DateInput
            value={date}
            onChange={(e) => setDate(e.target.value)}
            wrapperClassName="w-40 bg-transparent border-white/10"
          />
          <button
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Today shortcut */}
        {!isToday && (
          <button
            onClick={() => setDate(today)}
            className="px-3 py-1.5 text-xs bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors"
          >
            Today
          </button>
        )}

        {/* Room type filter */}
        {roomTypes.length > 1 && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 bg-black/40 border-white/10 text-sm h-9">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              {roomTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Live indicator */}
        {isToday && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 ml-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: isToday ? "Occupied" : "Checked In", value: stats.occupied, color: "text-red-400" },
          { label: "Available",  value: stats.available,  color: "text-emerald-400" },
          { label: isToday ? "Booked" : "Reserved", value: stats.booked, color: "text-primary" },
          { label: "Cleaning",   value: stats.cleaning,   color: "text-amber-400" },
        ].map((s) => (
          <Card key={s.label} className="p-3 bg-black/40 text-center border-white/5">
            <p className={`text-xl font-display font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Room grid */}
      <div className="flex-1 overflow-auto pb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-48 bg-card rounded-xl border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
            <CalendarDays className="w-10 h-10 mb-3" />
            <p className="text-sm">No rooms match the selected filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {rooms.map((room) =>
              isToday
                ? <LiveRoomCard key={room.id} room={room} />
                : <DateRoomCard key={room.id} room={room} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
