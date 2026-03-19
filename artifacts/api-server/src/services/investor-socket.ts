import type { Server as SocketServer } from "socket.io";
import { getInvestorDashboardSnapshot } from "./pnl-service";

export function initInvestorSocket(io: SocketServer) {
  io.on("connection", (socket) => {
    socket.on("join_investor", async ({ shareholderId }: { shareholderId: string }) => {
      socket.join(`investor:${shareholderId}`);
      try {
        const snapshot = await getInvestorDashboardSnapshot(shareholderId);
        socket.emit("dashboard_summary", snapshot);
      } catch (err) {
        console.error("Investor snapshot error:", err);
      }
    });

    socket.on("leave_investor", ({ shareholderId }: { shareholderId: string }) => {
      socket.leave(`investor:${shareholderId}`);
    });
  });

  // 5-minute summary refresh for all connected investors
  setInterval(async () => {
    const sockets = await io.fetchSockets();
    const investorRooms = new Set<string>(
      sockets.flatMap((s) => [...s.rooms]).filter((r) => r.startsWith("investor:"))
    );
    for (const room of investorRooms) {
      const shareholderId = room.replace("investor:", "");
      try {
        const snapshot = await getInvestorDashboardSnapshot(shareholderId);
        io.to(room).emit("dashboard_summary", snapshot);
      } catch (err) {
        console.error(`Periodic investor update error for ${shareholderId}:`, err);
      }
    }
  }, 5 * 60 * 1000);
}
