import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { initRoomSocket } from "./routes/rooms";
import { initInvestorSocket } from "./services/investor-socket";

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

httpServer.listen(port, () => {
  console.log(`KL Project API server listening on port ${port}`);
});
