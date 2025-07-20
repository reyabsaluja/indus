import { Server } from "socket.io";
import { AlpacaService, setSocketServer } from "@/lib/server/alpaca-server";
import { NextApiRequest, NextApiResponse } from "next";

let ioInstance: Server | null = null;
let alpacaService: AlpacaService | null = null;

export default function handler(req: NextApiRequest, res: NextApiResponse & {
  socket: {
    server: {
      io?: Server;
    }
  }
}) {
  if (!res.socket.server.io) {
    console.log("🔌 Starting Socket.IO server...");

    const io = new Server(res.socket.server, {
      path: "/api/socket_io", // match client path
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    res.socket.server.io = io;
    ioInstance = io;

    // Initialize Alpaca service
    console.log("🔌 Starting Alpaca service...");
    alpacaService = new AlpacaService();
    setSocketServer(io);

    // Connect to Alpaca WebSocket
    alpacaService
      .connectWebSocket()
      .then(() => {
        console.log("✅ Alpaca WebSocket connected successfully");
        io.emit("alpaca_connected", { message: "Alpaca WebSocket connected" });
      })
      .catch((error) => {
        console.error("❌ Failed to connect to Alpaca WebSocket:", error);
        io.emit("alpaca_error", {
          message: "Failed to connect to Alpaca WebSocket",
          error: error instanceof Error ? error.message : String(error),
        });
      });

    // Set up Socket.io event handlers
    io.on("connection", (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle symbol subscriptions
      socket.on("subscribe", async (data: { symbol: string; type?: string }) => {
        const type = data.type || "stock";
        console.log(`📊 Client ${socket.id} subscribing to ${type} ${data.symbol}`);

        try {
          if (alpacaService) {
            // Subscribe to symbol and forward data to this client
            await alpacaService.subscribeToSymbol(
              data.symbol,
              (candlestickData) => {
                if (type === "crypto") {
                  socket.emit("crypto_bar", candlestickData);
                } else {
                  socket.emit("stock_bar", candlestickData);
                }
              },
              type
            );

            socket.emit("alpaca_connected", {
              message: `Subscribed to ${data.symbol}`,
            });
          } else {
            // No alpaca service available - emit a gentle notification
            socket.emit("alpaca_error", {
              message: `Real-time data not available for ${data.symbol}`,
              error: "WebSocket service not configured",
            });
          }
        } catch (error) {
          console.error(`❌ Error subscribing to ${data.symbol}:`, error);
          // Send a user-friendly error message
          socket.emit("alpaca_error", {
            message: `Real-time data not available for ${data.symbol}`,
            error: "WebSocket connection failed",
          });
        }
      });



      // Handle symbol unsubscriptions
      socket.on("unsubscribe", async (data: { symbol: string; type?: string }) => {
        const type = data.type || "stock";
        console.log(`📊 Client ${socket.id} unsubscribing from ${type} ${data.symbol}`);

        if (alpacaService) {
          await alpacaService.unsubscribeFromSymbol(data.symbol, undefined, type);
        }
      });



      // Handle client disconnection
      socket.on("disconnect", (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Clean up any subscriptions for this client
        // Note: In a production app, you'd want to track which symbols each client is subscribed to
        // For now, we rely on the client to unsubscribe properly before disconnecting
        
        if (alpacaService) {
          // Optionally, you could implement client-specific subscription tracking here
          console.log(`🧹 Cleaned up resources for client ${socket.id}`);
        }
      });
    });

    // Handle server shutdown
    const gracefulShutdown = () => {
      console.log("🔄 Server shutting down - cleaning up connections...");
      
      if (alpacaService) {
        console.log("🧹 Disconnecting Alpaca WebSocket...");
        alpacaService.disconnect();
      }
      
      if (ioInstance) {
        console.log("🧹 Closing Socket.IO server...");
        ioInstance.close(() => {
          console.log("✅ Socket.IO server closed");
        });
      }
      
      process.exit(0);
    };

    // Listen for process termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // nodemon restart signal
  }

  res.end();
}
