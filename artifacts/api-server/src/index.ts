import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { initRoomSocket } from "./routes/rooms";
import { initInvestorSocket } from "./services/investor-socket";
import { initHostessAssignmentsSocket } from "./routes/hostessAssignments";
import { refreshFxRates } from "./services/currency-service";
import { initTelegramBot } from "./services/telegram-service";
import { seedDefaultData } from "./services/seed-service";
import { initProductionDb } from "./scripts/init-production-db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

initRoomSocket(io);
initInvestorSocket(io);
initHostessAssignmentsSocket(io);

initProductionDb()
  .then(() =>
    seedDefaultData().catch((err) =>
      console.error("[startup] Seed failed:", err)
    )
  )
  .catch((err) => console.error("[startup] DB init failed:", err));
refreshFxRates().catch((err) => console.error("[startup] FX refresh failed:", err));
setInterval(() => {
  refreshFxRates().catch((err) => console.error("[fx] Periodic refresh failed:", err));
}, 60 * 60 * 1000);

initTelegramBot().catch((err) => console.error("[startup] Telegram init failed:", err));

httpServer.listen(port, () => {
  console.log(`KL Project API server listening on port ${port}`);
});
