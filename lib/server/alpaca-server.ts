// Alpaca API service for fetching stock data using official npm package
// You'll need to get API keys from: https://alpaca.markets/

import Alpaca from "@alpacahq/alpaca-trade-api";

interface WebSocketMessage {
  T: string; // message type
  S: string; // symbol
  t: string; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  n: number; // number of trades
  vw: number; // volume weighted average price
}

type DataCallback = (data: any) => void;

// Helper function to convert timestamp to EST timezone (same as alpaca route)
function convertToESTTimestamp(timestamp: string | Date): number {
  const date = new Date(timestamp);
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60 * 1000) / 1000);
}

let socketServer: any; // We'll inject this from /api/socket

export function setSocketServer(io: any) {
  socketServer = io;
}

export class AlpacaService {
  private alpaca: any = null;
  private ws: any = null; // Stock WebSocket (data_stream_v2)
  private cryptoWs: any = null; // Crypto WebSocket (crypto_stream_v1beta3)
  private isConnected = false;
  private isCryptoConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private dataCallbacks: Map<string, DataCallback[]> = new Map();
  private subscribedSymbols: Set<string> = new Set();
  private intentionalDisconnect = false; // Flag to suppress reconnects during intentional disconnection

  // Initialize Alpaca client dynamically
  private async initializeAlpaca() {
    if (this.alpaca) return this.alpaca;

    try {
      // Check if API keys are configured
      if (
        !process.env.NEXT_PUBLIC_ALPACA_API_KEY ||
        !process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY
      ) {
        throw new Error(
          "Alpaca API keys are not configured. Please set NEXT_PUBLIC_ALPACA_API_KEY and NEXT_PUBLIC_ALPACA_SECRET_KEY in your .env.local file.",
        );
      }

      const isPaper = process.env.NEXT_PUBLIC_ALPACA_IS_PAPER || "true";

      this.alpaca = new Alpaca({
        keyId: process.env.NEXT_PUBLIC_ALPACA_API_KEY,
        secretKey: process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY,
        paper: isPaper
      });

      console.log(`Alpaca initialized successfully (Paper: ${isPaper}).`);
      return this.alpaca;
    } catch (error) {
      console.error("Failed to initialize Alpaca client:", error);
      throw error;
    }
  }

  // WebSocket methods for live data using official package
  async connectWebSocket(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const alpaca = await this.initializeAlpaca();

        // Initialize both stock and crypto WebSockets
        this.ws = alpaca.data_stream_v2; // Stock WebSocket
        this.cryptoWs = alpaca.crypto_stream_v1beta3; // Crypto WebSocket

        let stockConnected = false;
        let cryptoConnected = false;
        
        const checkBothConnected = () => {
          if (stockConnected && cryptoConnected) {
            console.log("✅ Both stock and crypto WebSockets connected");
            resolve();
          }
        };

        // Stock WebSocket handlers
        this.ws.onConnect(() => {
          console.log("✅ Stock WebSocket connected to Alpaca");
          this.isConnected = true;
          stockConnected = true;
          this.reconnectAttempts = 0;
          this.intentionalDisconnect = false; // Reset flag on successful connection

          // Emit connection status to all clients
          if (socketServer) {
            socketServer.emit("alpaca_connected", {
              message: "Alpaca Stock WebSocket connected",
            });
          }

          checkBothConnected();
        });

        this.ws.onDisconnect(() => {
          console.log("❌ Stock WebSocket disconnected from Alpaca");
          this.isConnected = false;

          // Emit disconnection status to all clients
          if (socketServer) {
            socketServer.emit("alpaca_disconnected", {
              message: "Alpaca Stock WebSocket disconnected",
            });
          }

          // Only attempt reconnect if not intentionally disconnecting
          if (!this.intentionalDisconnect) {
            this.handleReconnect();
          }
        });

        // Crypto WebSocket handlers
        this.cryptoWs.onConnect(() => {
          console.log("✅ Crypto WebSocket connected to Alpaca");
          this.isCryptoConnected = true;
          cryptoConnected = true;
          this.intentionalDisconnect = false; // Reset flag on successful connection

          // Emit connection status to all clients
          if (socketServer) {
            socketServer.emit("alpaca_connected", {
              message: "Alpaca Crypto WebSocket connected",
            });
          }

          checkBothConnected();
        });

        this.cryptoWs.onDisconnect(() => {
          console.log("❌ Crypto WebSocket disconnected from Alpaca");
          this.isCryptoConnected = false;

          // Emit disconnection status to all clients
          if (socketServer) {
            socketServer.emit("alpaca_disconnected", {
              message: "Alpaca Crypto WebSocket disconnected",
            });
          }

          // Only attempt reconnect if not intentionally disconnecting
          if (!this.intentionalDisconnect) {
            this.handleReconnect();
          }
        });

        // Handle stock trade data
        this.ws.onStockTrade((trade: any) => {
          const symbol = trade.Symbol || trade.symbol;
          console.log(`📊 Received stock trade for ${symbol}: $${trade.Price || trade.price}`);
          this.handleTradeData(trade);
        });

        // Handle stock bar data (candlesticks)
        this.ws.onStockBar((bar: any) => {
          console.log("🔍 DEBUG: Received stock bar data:", bar);
          this.handleBarData(bar);
        });

        // Handle crypto bar data from crypto stream
        this.cryptoWs.onCryptoBar((bar: any) => {
          console.log("🔍 DEBUG: Received crypto bar data:", bar);
          this.handleCryptoBarData(bar);
        });

        // Stock WebSocket error handling
        this.ws.onError((error: any) => {
          console.error("🔴 Stock WebSocket error:", error);

          // Emit error to all clients
          if (socketServer) {
            socketServer.emit("alpaca_error", {
              message: "Alpaca Stock WebSocket error",
              error: error instanceof Error ? error.message : String(error),
            });
          }

          reject(error);
        });

        // Crypto WebSocket error handling
        this.cryptoWs.onError((error: any) => {
          console.error("🔴 Crypto WebSocket error:", error);

          // Emit error to all clients
          if (socketServer) {
            socketServer.emit("alpaca_error", {
              message: "Alpaca Crypto WebSocket error",
              error: error instanceof Error ? error.message : String(error),
            });
          }

          reject(error);
        });

        // Connect both WebSockets
        this.ws.connect();
        this.cryptoWs.connect();
      } catch (error) {
        console.error("Failed to connect to Alpaca WebSocket:", error);
        reject(error);
      }
    });
  }

  private handleTradeData(trade: any) {
    // Alpaca SDK returns PascalCase properties (Symbol, Price, etc.)
    const symbol = trade.Symbol || trade.symbol;

    // Only process if we have callbacks for this symbol
    if (!this.dataCallbacks.has(symbol)) return;

    const price = trade.Price || trade.price;
    const timestamp = trade.Timestamp || trade.timestamp;
    const size = trade.Size || trade.size || 1;

    const candlestickData = {
      time: convertToESTTimestamp(timestamp),
      open: price,
      high: price,
      low: price,
      close: price,
      volume: size,
    };

    // Notify all callbacks for this symbol
    const callbacks = this.dataCallbacks.get(symbol);
    if (callbacks) {
      callbacks.forEach((callback) => callback(candlestickData));
    }
  }

  private handleBarData(bar: any) {
    // Alpaca SDK returns PascalCase properties (Symbol, Open, High, etc.)
    const symbol = bar.Symbol || bar.symbol;

    // Only process if we have callbacks for this symbol
    if (!this.dataCallbacks.has(symbol)) return;

    const candlestickData = {
      time: convertToESTTimestamp(bar.Timestamp || bar.timestamp),
      open: bar.Open || bar.open,
      high: bar.High || bar.high,
      low: bar.Low || bar.low,
      close: bar.Close || bar.close,
      volume: bar.Volume || bar.volume,
    };

    // Notify all callbacks for this symbol
    const callbacks = this.dataCallbacks.get(symbol);
    if (callbacks) {
      callbacks.forEach((callback) => callback(candlestickData));
    }
  }

  private handleCryptoBarData(bar: any) {
    const symbol = bar.S || bar.symbol; // Alpaca crypto uses 'S' for symbol

    console.log(`📊 Processing crypto bar for ${symbol}:`, bar);

    // Only process if we have callbacks for this symbol
    if (!this.dataCallbacks.has(symbol)) {
      console.log(`❌ No callbacks found for symbol: ${symbol}`);
      console.log(`Available symbols:`, Array.from(this.dataCallbacks.keys()));
      return;
    }

    const candlestickData = {
      time: convertToESTTimestamp(bar.Timestamp || bar.timestamp),
      open: bar.Open || bar.open,
      high: bar.High || bar.high,
      low: bar.Low || bar.low,
      close: bar.Close || bar.close,
      volume: bar.Volume || bar.volume,
    };

    console.log(`📈 Sending candlestick data for ${symbol}:`, candlestickData);

    // Notify all callbacks for this symbol
    const callbacks = this.dataCallbacks.get(symbol);
    if (callbacks) {
      callbacks.forEach((callback) => callback(candlestickData));
    }
  }

  private handleReconnect() {
    // Don't attempt reconnect if we're intentionally disconnecting
    if (this.intentionalDisconnect) {
      console.log("🛑 Skipping reconnect - intentional disconnection");
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
      );

      setTimeout(() => {
        this.connectWebSocket().catch((error) => {
          console.error("Reconnection failed:", error);
        });
      }, 1000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error("❌ Max reconnection attempts reached");
    }
  }

  // Subscribe to live data for a symbol using official package
  async subscribeToSymbol(symbol: string, callback: DataCallback, type: string = "stock") {
    console.log(`🔔 Attempting to subscribe to ${type} symbol: ${symbol}`);
    
    if (type === "crypto" && !this.isCryptoConnected) {
      console.error("❌ Crypto WebSocket not connected");
      throw new Error("Crypto WebSocket not connected");
    } else if (type === "stock" && !this.isConnected) {
      console.error("❌ Stock WebSocket not connected");
      throw new Error("Stock WebSocket not connected");
    }

    // Store callback
    if (!this.dataCallbacks.has(symbol)) {
      this.dataCallbacks.set(symbol, []);
    }
    this.dataCallbacks.get(symbol)!.push(callback);
    console.log(`✅ Added callback for ${symbol}. Total callbacks: ${this.dataCallbacks.get(symbol)!.length}`);

    // Subscribe using official package if not already subscribed
    if (!this.subscribedSymbols.has(symbol)) {
      if (type === "crypto") {
        // Subscribe to crypto data using crypto stream
        this.cryptoWs.subscribeForBars([symbol]);
        console.log(`📊 Subscribed to live crypto data for ${symbol}`);
      } else {
        // Subscribe to stock data using stock stream
        this.ws.subscribeForTrades([symbol]);
        this.ws.subscribeForBars([symbol]);
        console.log(`📊 Subscribed to live stock data for ${symbol}`);
      }
      
      this.subscribedSymbols.add(symbol);
      console.log(`🎯 Successfully subscribed to ${symbol}. Total subscriptions: ${this.subscribedSymbols.size}`);
    } else {
      console.log(`⚠️ Already subscribed to ${symbol}, just added callback`);
    }
  }

  // Unsubscribe from live data for a symbol
  async unsubscribeFromSymbol(symbol: string, callback?: DataCallback, type: string = "stock") {
    // Check if the appropriate stream is connected
    if ((type === "crypto" && !this.isCryptoConnected) || (type === "stock" && !this.isConnected)) {
      return;
    }

    if (callback) {
      // Remove specific callback
      const callbacks = this.dataCallbacks.get(symbol);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    } else {
      // Remove all callbacks for this symbol
      this.dataCallbacks.delete(symbol);
    }

    // Unsubscribe using official package if no more callbacks for this symbol
    if (!this.dataCallbacks.has(symbol) && this.subscribedSymbols.has(symbol)) {
      if (type === "crypto") {
        // Unsubscribe from crypto data using crypto stream
        this.cryptoWs.unsubscribeFromBars([symbol]);
        console.log(`📊 Unsubscribed from live crypto data for ${symbol}`);
      } else {
        // Unsubscribe from stock data using stock stream
        this.ws.unsubscribeFromTrades([symbol]);
        this.ws.unsubscribeFromBars([symbol]);
        console.log(`📊 Unsubscribed from live stock data for ${symbol}`);
      }
      
      this.subscribedSymbols.delete(symbol);
    }
  }

  // Disconnect WebSocket
  disconnect() {
    console.log("🔄 Disconnecting Alpaca WebSocket connections...");
    
    // Set flag to prevent reconnection attempts
    this.intentionalDisconnect = true;
    
    // Unsubscribe from all symbols first
    if (this.subscribedSymbols.size > 0) {
      console.log(`🧹 Unsubscribing from ${this.subscribedSymbols.size} symbols...`);
      
      for (const symbol of this.subscribedSymbols) {
        try {
          if (this.ws && this.isConnected) {
            this.ws.unsubscribeFromTrades([symbol]);
            this.ws.unsubscribeFromBars([symbol]);
          }
          if (this.cryptoWs && this.isCryptoConnected) {
            this.cryptoWs.unsubscribeFromBars([symbol]);
          }
        } catch (error) {
          console.error(`❌ Error unsubscribing from ${symbol}:`, error);
        }
      }
    }
    
    // Disconnect stock WebSocket
    if (this.ws) {
      console.log("🧹 Disconnecting stock WebSocket...");
      try {
        this.ws.disconnect();
      } catch (error) {
        console.error("❌ Error disconnecting stock WebSocket:", error);
      }
      this.ws = null;
      this.isConnected = false;
    }
    
    // Disconnect crypto WebSocket
    if (this.cryptoWs) {
      console.log("🧹 Disconnecting crypto WebSocket...");
      try {
        this.cryptoWs.disconnect();
      } catch (error) {
        console.error("❌ Error disconnecting crypto WebSocket:", error);
      }
      this.cryptoWs = null;
      this.isCryptoConnected = false;
    }
    
    // Clear all callbacks and subscriptions
    this.dataCallbacks.clear();
    this.subscribedSymbols.clear();
    console.log("✅ Alpaca WebSocket cleanup completed");
  }


}
