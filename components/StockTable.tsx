"use client";

import React from "react";
import Hoverable from "./Hoverable";
import MetricNameHover from "./MetricNameHover";

const STOCKS = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 192.32,
    pe_ratio: 28.5,
    volume: 51200000,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    price: 720.11,
    pe_ratio: 65.0,
    volume: 34000000,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    price: 2750.45,
    pe_ratio: 30.2,
    volume: 1800000,
  },
];

const StockTable: React.FC = () => {
  // Standardized formatting functions
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return "—";
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value?: number) => {
    if (value === undefined || value === null) return "—";
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toFixed(0);
  };

  return (
    <div
      className="overflow-x-hidden text-black"
      style={{ overflowY: "hidden", paddingTop: "80px", marginTop: "-80px" }}
    >
      <table className="w-full bg-white border border-gray-200 rounded-lg shadow">
        <thead>
          <tr>
            <th className="px-4 py-2 border-b">Symbol</th>
            <th className="px-4 py-2 border-b">Name</th>
            <th className="px-4 py-2 border-b">
              <MetricNameHover metricName="Stock Price">Price</MetricNameHover>
            </th>
            <th className="px-4 py-2 border-b">
              <MetricNameHover metricName="P/E Ratio">
                P/E Ratio
              </MetricNameHover>
            </th>
            <th className="px-4 py-2 border-b">
              <MetricNameHover metricName="Trading Volume">
                Volume
              </MetricNameHover>
            </th>
          </tr>
        </thead>
        <tbody>
          {STOCKS.map((stock) => (
            <tr key={stock.symbol} className="text-center">
              <td className="px-4 py-2 border-b">{stock.symbol}</td>
              <td className="px-4 py-2 border-b">{stock.name}</td>
              <td className="px-4 py-2 border-b">
                <Hoverable
                  symbol={stock.symbol}
                  metric="price"
                  value={stock.price}
                >
                  {formatCurrency(stock.price)}
                </Hoverable>
              </td>
              <td className="px-4 py-2 border-b">
                <Hoverable
                  symbol={stock.symbol}
                  metric="pe_ratio"
                  value={stock.pe_ratio}
                >
                  {stock.pe_ratio}
                </Hoverable>
              </td>
              <td className="px-4 py-2 border-b">
                <Hoverable
                  symbol={stock.symbol}
                  metric="volume"
                  value={stock.volume}
                >
                  {formatNumber(stock.volume)}
                </Hoverable>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockTable;
