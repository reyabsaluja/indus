import { Server } from "socket.io";
import { AlpacaService, setSocketServer } from "@/lib/server/alpaca-server";
import { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";

let ioInstance: Server | null = null;
let alpacaService: AlpacaService | null = null;
let alpacaReady = false;
let alpacaConnectionPromise: Promise<void> | null = null;

interface BarData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Access the underlying HTTP server with Socket.IO extension
  const httpServer = (res.socket as { server?: HTTPServer & { io?: Server } })?.server as HTTPServer & { io?: Server };
  
  if (!httpServer.io) {
    console.log("🔌 Starting Socket.IO server...");

    const io = new Server(httpServer, {
      path: "/api/socket_io", // match client path
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    httpServer.io = io;
    ioInstance = io;

    // Initialize Alpaca service
    console.log("🔌 Starting Alpaca service...");
    alpacaService = new AlpacaService();
    setSocketServer(io);

    // Connect to Alpaca WebSocket and track the promise
    alpacaConnectionPromise = alpacaService
      .connectWebSocket()
      .then(() => {
        console.log("✅ Alpaca WebSocket connected successfully");
        alpacaReady = true;
        io.emit("alpaca_connected", { message: "Alpaca WebSocket connected" });
      })
      .catch((error) => {
        console.error("❌ Failed to connect to Alpaca WebSocket:", error);
        alpacaReady = false;
        io.emit("alpaca_error", {
          message: "Failed to connect to Alpaca WebSocket",
          error: error instanceof Error ? error.message : String(error),
        });
      });

    // Track subscriptions per client so we can clean up on disconnect
    const clientSubscriptions = new Map<string, { symbol: string; type: string; callback: (data: BarData) => void }[]>();

    // Set up Socket.io event handlers
    io.on("connection", (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      
      // Initialize subscription tracking for this client
      clientSubscriptions.set(socket.id, []);

      // Handle symbol subscriptions
      socket.on("subscribe", async (data: { symbol: string; type?: string }) => {
        const type = data.type || "stock";
        console.log(`📊 Client ${socket.id} subscribing to ${type} ${data.symbol}`);

        try {
          if (alpacaService) {
            // Wait for Alpaca connection if not ready yet
            if (!alpacaReady && alpacaConnectionPromise) {
              console.log(`⏳ Waiting for Alpaca WebSocket to connect before subscribing to ${data.symbol}...`);
              await alpacaConnectionPromise;
            }

            // Check if connection succeeded
            if (!alpacaReady) {
              socket.emit("alpaca_error", {
                message: `Real-time data not available for ${data.symbol}`,
                error: "Alpaca WebSocket connection failed",
              });
              return;
            }

            // Create a callback specific to this client
            const callback = (candlestickData: BarData) => {
              if (type === "crypto") {
                socket.emit("crypto_bar", candlestickData);
              } else {
                socket.emit("stock_bar", candlestickData);
              }
            };

            // Subscribe to symbol and forward data to this client
            await alpacaService.subscribeToSymbol(data.symbol, callback, type);
            
            // Track this subscription for cleanup on disconnect
            const subs = clientSubscriptions.get(socket.id);
            if (subs) {
              subs.push({ symbol: data.symbol, type, callback });
            }

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
          // Find and remove the callback for this client's subscription
          const subs = clientSubscriptions.get(socket.id);
          if (subs) {
            const subIndex = subs.findIndex(s => s.symbol === data.symbol && s.type === type);
            if (subIndex > -1) {
              const sub = subs[subIndex];
              await alpacaService.unsubscribeFromSymbol(data.symbol, sub.callback, type);
              subs.splice(subIndex, 1);
            }
          }
        }
      });

      // Handle client disconnection
      socket.on("disconnect", (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Clean up all subscriptions for this client
        if (alpacaService) {
          const subs = clientSubscriptions.get(socket.id);
          if (subs && subs.length > 0) {
            console.log(`🧹 Cleaning up ${subs.length} subscription(s) for client ${socket.id}`);
            for (const sub of subs) {
              try {
                // Remove this client's callback from the symbol subscription
                alpacaService.unsubscribeFromSymbol(sub.symbol, sub.callback, sub.type);
              } catch (error) {
                console.error(`❌ Error cleaning up subscription for ${sub.symbol}:`, error);
              }
            }
          }
        }
        
        // Remove client from tracking
        clientSubscriptions.delete(socket.id);
        console.log(`🧹 Cleaned up resources for client ${socket.id}`);
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
