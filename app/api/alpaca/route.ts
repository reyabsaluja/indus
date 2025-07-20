import { NextRequest, NextResponse } from "next/server";
import Alpaca from "@alpacahq/alpaca-trade-api";

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Helper function to convert timestamp to EST timezone
function convertToESTTimestamp(timestamp: string | Date): number {
  const date = new Date(timestamp);
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60 * 1000) / 1000);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const type = searchParams.get("type") || "stock"; // "stock" or "crypto"
  const timeframe = searchParams.get("timeframe") || "1Min";
  const limit = parseInt(searchParams.get("limit") || "10000"); // Reduced limit for better performance
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    // Initialize Alpaca client
    if (
      !process.env.NEXT_PUBLIC_ALPACA_API_KEY ||
      !process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY
    ) {
      return NextResponse.json(
        { error: "Alpaca API keys not configured" },
        { status: 500 },
      );
    }

    const isPaper = process.env.NEXT_PUBLIC_ALPACA_IS_PAPER === "true";
    const alpaca = new Alpaca({
      keyId: process.env.NEXT_PUBLIC_ALPACA_API_KEY,
      secretKey: process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY,
      paper: isPaper,
      usePolygon: false,
    });

    console.log(`📊 Fetching historical data for ${symbol} (${timeframe})`);

    // Calculate start and end dates
    let startDate: Date;
    let endDate: Date;

    if (startParam && endParam) {
      // Use custom date range
      startDate = new Date(parseInt(startParam) * 1000);
      endDate = new Date(parseInt(endParam) * 1000);
    } else {
      // Use default date range based on timeframe
      endDate = new Date();

      switch (timeframe) {
        case "1Min":
        case "5Min":
          startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          break;
        case "15Min":
        case "1Hour":
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "1Day":
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1Week":
        case "1Month":
          startDate = new Date(Date.now() - 1 * 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      }
    }

    // Get historical bars - fetch ALL available history using pagination
    const historicalData: BarData[] = [];
    let pageToken: string | undefined = undefined;
    let totalFetched = 0;

    if (type === "crypto") {
      // Use getCryptoBars for crypto symbols
      console.log(`📊 Fetching crypto bars for ${symbol} from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);
      
      const barsResponse = await alpaca.getCryptoBars([symbol.toUpperCase()], {
        start: startDate,
        end: endDate,
        timeframe: timeframe,
        limit: limit
      });

      // getCryptoBars returns different format - handle the response properly
      for await (const [, bars] of barsResponse) {
        if (bars && Array.isArray(bars)) {
          for (const bar of bars) {
            const processedBar = {
              time: convertToESTTimestamp(bar.Timestamp),
              open: bar.Open,
              high: bar.High,
              low: bar.Low,
              close: bar.Close,
              volume: bar.Volume,
            };
            historicalData.push(processedBar);
            totalFetched++;
          }
          
          // Log first and last bars for debugging
          if (bars.length > 0) {
            console.log(`📅 First bar timestamp: ${bars[0].Timestamp} (${new Date(bars[0].Timestamp).toLocaleString()})`);
            console.log(`📅 Last bar timestamp: ${bars[bars.length - 1].Timestamp} (${new Date(bars[bars.length - 1].Timestamp).toLocaleString()})`);
          }
        }
      }

      console.log(`📊 Fetched ${totalFetched} crypto bars for ${symbol}`);
    } else {
      // Use getBarsV2 for stock symbols (existing logic)
      do {
        const barsResponse = await alpaca.getBarsV2(symbol.toUpperCase(), {
          start: startDate,
          end: endDate,
          timeframe: timeframe,
          limit: limit,
          feed: "iex",
          page_token: pageToken,
        });

        let batchCount = 0;
        for await (const bar of barsResponse) {
          const processedBar = {
            time: convertToESTTimestamp(bar.Timestamp),
            open: bar.OpenPrice,
            high: bar.HighPrice,
            low: bar.LowPrice,
            close: bar.ClosePrice,
            volume: bar.Volume,
          };
          historicalData.push(processedBar);
          batchCount++;
        }

        totalFetched += batchCount;
        console.log(
          `📊 Fetched ${batchCount} stock bars (total: ${totalFetched}) for ${symbol}`,
        );

        // Get the next page token if available
        pageToken = (barsResponse as { next_page_token?: string }).next_page_token;

        // Break if no more data or we hit a reasonable limit to prevent infinite loops
        if (!pageToken || batchCount === 0 || totalFetched > 1000000) {
          break;
        }
      } while (pageToken);
    }

    // Sort data by time to ensure proper ordering (keep this for chart compatibility)
    const sortedData = historicalData.sort((a, b) => a.time - b.time);

    console.log(
      `📊 Retrieved ${sortedData.length} historical bars for ${symbol} (${startDate.toLocaleString()} to ${endDate.toLocaleString()})`,
    );

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      timeframe,
      data: sortedData,
      metadata: {
        totalBars: sortedData.length,
        timeframe: timeframe,
        dateRange:
          sortedData.length > 0
            ? {
                start: new Date(sortedData[0].time * 1000).toLocaleString(),
                end: new Date(
                  sortedData[sortedData.length - 1].time * 1000,
                ).toLocaleString(),
              }
            : null,
      },
    });
  } catch (error) {
    console.error(`❌ Error fetching historical data for ${symbol}:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch historical data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}


