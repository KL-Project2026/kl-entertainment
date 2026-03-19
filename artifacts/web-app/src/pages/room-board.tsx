import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import { useListBranches, useGetBranchRoomBoard, useUpdateRoomStatus, getGetBranchRoomBoardQueryKey } from "@workspace/api-client-react";
import { Tabs, Card, Badge } from "@/components/ui";
import { useLiveTimer } from "@/hooks/use-live-timer";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Clock, Users } from "lucide-react";
import type { RoomWithReservation, UpdateRoomStatusRequestStatus } from "@workspace/api-client-react";

// Individual Room Card Component
function RoomCard({ room }: { room: RoomWithReservation }) {
  const timer = useLiveTimer(room.status === 'occupied' ? room.checkInTime : null);
  const updateStatusMutation = useUpdateRoomStatus();

  const handleStatusChange = (newStatus: UpdateRoomStatusRequestStatus) => {
    updateStatusMutation.mutate({ id: room.id, data: { status: newStatus } });
  };

  const statusColors = {
    available: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    occupied: "bg-red-500/10 border-red-500/30 text-red-400",
    cleaning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    maintenance: "bg-gray-500/10 border-gray-500/30 text-gray-400",
    blocked: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  };

  const statusGlows = {
    available: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    occupied: "shadow-[0_0_15px_rgba(239,68,68,0.2)]",
    cleaning: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    maintenance: "shadow-none",
    blocked: "shadow-none",
  };

  return (
    <Card className={`flex flex-col relative overflow-hidden transition-all duration-300 hover:scale-[1.02] cursor-pointer ${statusGlows[room.status]}`}>
      <div className={`h-1.5 w-full ${statusColors[room.status].split(' ')[0].replace('/10', '')}`} />
      
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-display text-2xl font-bold">{room.name}</h3>
          <Badge variant={room.roomType.includes('vip') ? 'warning' : 'neutral'} className="uppercase">
            {room.roomType.replace('_', ' ')}
          </Badge>
        </div>

        {room.status === 'occupied' ? (
          <div className="flex-1 flex flex-col justify-center space-y-3 bg-black/20 p-3 rounded-lg border border-white/5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Guest</span>
              <span className="font-medium truncate max-w-[120px]">{room.guestName || 'Walk-in'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground"><Users className="w-4 h-4 inline mr-1" /> Pax</span>
              <span className="font-medium">{room.guestCount || room.capacityMin} / {room.capacityMax}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-white/5">
              <span className="text-primary font-bold flex items-center gap-1">
                <Clock className="w-4 h-4" /> {timer}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <span className={`px-3 py-1 rounded-full text-xs uppercase font-bold tracking-wider border ${statusColors[room.status]}`}>
              {room.status}
            </span>
            <span className="text-muted-foreground text-sm mt-3">
              Cap: {room.capacityMin}-{room.capacityMax} pax
            </span>
          </div>
        )}
      </div>

      {/* Quick Action Overlay (Hover) */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10">
        {room.status === 'available' && (
          <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded border border-red-500/30 text-sm font-medium hover:bg-red-500 hover:text-white transition-colors" onClick={() => handleStatusChange('occupied')}>
            Walk-in Check-in
          </button>
        )}
        {room.status === 'occupied' && (
          <button className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 text-sm font-medium hover:bg-amber-500 hover:text-white transition-colors" onClick={() => handleStatusChange('cleaning')}>
            Check-out
          </button>
        )}
        {room.status === 'cleaning' && (
          <button className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500 hover:text-white transition-colors" onClick={() => handleStatusChange('available')}>
            Mark Cleaned
          </button>
        )}
      </div>
    </Card>
  );
}

export default function RoomBoard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(user?.branchId || null);

  const { data: branchesData } = useListBranches();
  
  useEffect(() => {
    if (!selectedBranchId && branchesData?.data && branchesData.data.length > 0) {
      setSelectedBranchId(branchesData.data[0].id);
    }
  }, [branchesData, selectedBranchId]);

  const { data: boardData, isLoading } = useGetBranchRoomBoard(selectedBranchId || "", {
    query: { enabled: !!selectedBranchId }
  });

  // WebSocket Connection
  useEffect(() => {
    if (!selectedBranchId) return;

    const socket = io(window.location.origin, { path: "/socket.io" });
    
    socket.on("connect", () => {
      socket.emit("join_branch", { branchId: selectedBranchId });
    });

    socket.on("room_board_update", (updatedData) => {
      // Optimistically update the cache with new real-time data
      if (updatedData) {
         queryClient.setQueryData(getGetBranchRoomBoardQueryKey(selectedBranchId), updatedData);
      } else {
         queryClient.invalidateQueries({ queryKey: getGetBranchRoomBoardQueryKey(selectedBranchId) });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedBranchId, queryClient]);

  const rooms = boardData?.rooms || [];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center">
        {user?.role === 'super_admin' && branchesData?.data ? (
          <Tabs 
            tabs={branchesData.data.map(b => ({ id: b.id, label: b.name }))}
            activeTab={selectedBranchId || ""}
            onChange={setSelectedBranchId}
          />
        ) : (
          <h2 className="text-xl font-display font-semibold text-primary">Live Board</h2>
        )}

        <div className="flex gap-4 text-xs font-medium bg-black/40 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" /> Available</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#EF4444]" /> Occupied</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#F59E0B]" /> Cleaning</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-48 bg-card rounded-xl border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room as RoomWithReservation} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
