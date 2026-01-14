import { NextRequest, NextResponse } from "next/server";
import Alpaca from "@alpacahq/alpaca-trade-api";

const EST_TIMEZONE_OFFSET = 5 * 60 * 60; // 5 hours in seconds

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Helper function to convert timestamp to EST timezone
// DO NOT REMOVE THIS FUNCTION: Lightweight Charts does not support local timezones so the timezone is always EST
function convertToESTTimestamp(timestamp: string | Date): number {
  const date = new Date(timestamp);
  return Math.floor((date.getTime() - EST_TIMEZONE_OFFSET * 1000) / 1000);
}

// Helper function to revert the EST timestamp conversion to UTC
// DO NOT REMOVE THIS FUNCTION: Lightweight Charts does not support local timezones so the timezone is always EST
function convertToUTCTimestamp(estTimestamp: number): number {
    return estTimestamp + EST_TIMEZONE_OFFSET;
  }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const type = searchParams.get("type") || "stock"; // "stock" or "crypto"
  const timeframe = searchParams.get("timeframe") || "1Min";
  const limit = parseInt(searchParams.get("limit") || "2000"); // Reduced limit for better performance
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
    // Use default date range based on timeframe if no end date is provided
    const endDate: Date = endParam ? new Date(parseInt(endParam) * 1000) : new Date();

    if (startParam) {
      // Use custom start date
      startDate = new Date(parseInt(startParam) * 1000);
    } else {
      // Date ranges optimized for ~1000 bars with clean calendar intervals
      switch (timeframe) {
        case "1Min":
          startDate = new Date(endDate.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days
          break;
        case "5Min":
          startDate = new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000); // 2 weeks
          break;
        case "15Min":
          startDate = new Date(endDate.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days
          break;
        case "1Hour":
          startDate = new Date(endDate.getTime() - 180 * 24 * 60 * 60 * 1000); // 6 months
          break;
        case "1Day":
          startDate = new Date(endDate.getTime() - 4 * 365 * 24 * 60 * 60 * 1000); // 4 years
          break;
        case "1Week":
          startDate = new Date(endDate.getTime() - 20 * 365 * 24 * 60 * 60 * 1000); // 20 years
          break;
        case "1Month":
          startDate = new Date(endDate.getTime() - 20 * 365 * 24 * 60 * 60 * 1000); // 20 years
          break;
        default:
          startDate = new Date(endDate.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days
      }
    }

    // Get historical bars - fetch ALL available history using pagination
    const historicalData: BarData[] = [];
    let pageToken: string | undefined = undefined;
    let totalFetched = 0;

    console.log(`📊 Fetching stock bars for ${symbol} from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);

    if (type === "crypto") {
      // Use getCryptoBars for crypto symbols
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
          adjustment: "split", // Adjust for stock splits to prevent price discontinuities
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
      data: sortedData,
      isEmpty: sortedData.length < 2,
      symbol: symbol.toUpperCase(),
      timeframe: timeframe,
      totalBars: sortedData.length,
      // Convert back from EST to UTC
      earliestTimestamp: sortedData.length > 0 ? convertToUTCTimestamp(sortedData[0].time) : null,
      latestTimestamp: sortedData.length > 0 ? convertToUTCTimestamp(sortedData[sortedData.length - 1].time) : null,
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


