"use client";

import React from "react";
import Hoverable from "./Hoverable";
import MetricNameHover from "./MetricNameHover";

const CRYPTOS = [
	{
		symbol: "BTC",
		name: "Bitcoin",
		price: 43250.75,
		market_cap: 845000000000,
		volume_24h: 15200000000,
		percent_change_24h: 2.45,
	},
	{
		symbol: "ETH",
		name: "Ethereum",
		price: 2650.42,
		market_cap: 318000000000,
		volume_24h: 8200000000,
		percent_change_24h: -1.23,
	},
	{
		symbol: "BNB",
		name: "BNB",
		price: 315.89,
		market_cap: 47200000000,
		volume_24h: 890000000,
		percent_change_24h: 0.87,
	},
	{
		symbol: "SOL",
		name: "Solana",
		price: 98.76,
		market_cap: 44500000000,
		volume_24h: 1200000000,
		percent_change_24h: 4.56,
	},
];

const CryptoTable: React.FC = () => {
	return (
		<div className="overflow-x-hidden text-black" style={{ overflowY: "hidden", paddingTop: "80px", marginTop: "-80px" }}>
			<table className="w-full bg-white border border-gray-200 rounded-lg shadow">
				<thead>
					<tr>
						<th className="px-4 py-2 border-b">Symbol</th>
						<th className="px-4 py-2 border-b">Name</th>
						<th className="px-4 py-2 border-b">
							<MetricNameHover metricName="Crypto Price">Price</MetricNameHover>
						</th>
						<th className="px-4 py-2 border-b">
							<MetricNameHover metricName="Market Cap">Market Cap</MetricNameHover>
						</th>
						<th className="px-4 py-2 border-b">
							<MetricNameHover metricName="24h Volume">24h Volume</MetricNameHover>
						</th>
						<th className="px-4 py-2 border-b">
							<MetricNameHover metricName="24h Change">24h Change</MetricNameHover>
						</th>
					</tr>
				</thead>
				<tbody>
					{CRYPTOS.map((crypto) => (
						<tr key={crypto.symbol} className="text-center">
							<td className="px-4 py-2 border-b">{crypto.symbol}</td>
							<td className="px-4 py-2 border-b">{crypto.name}</td>
							<td className="px-4 py-2 border-b">
								<Hoverable symbol={crypto.symbol} metric="price" value={crypto.price}>
									${crypto.price.toLocaleString()}
								</Hoverable>
							</td>
							<td className="px-4 py-2 border-b">
								<Hoverable symbol={crypto.symbol} metric="market_cap" value={crypto.market_cap}>
									${(crypto.market_cap / 1e9).toFixed(1)}B
								</Hoverable>
							</td>
							<td className="px-4 py-2 border-b">
								<Hoverable symbol={crypto.symbol} metric="volume_24h" value={crypto.volume_24h}>
									${(crypto.volume_24h / 1e9).toFixed(1)}B
								</Hoverable>
							</td>
							<td className="px-4 py-2 border-b">
								<Hoverable symbol={crypto.symbol} metric="percent_change_24h" value={crypto.percent_change_24h}>
									<span className={`${crypto.percent_change_24h >= 0 ? "text-green-600" : "text-red-600"} font-medium`}>
										{crypto.percent_change_24h >= 0 ? "+" : ""}
										{crypto.percent_change_24h.toFixed(2)}%
									</span>
								</Hoverable>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default CryptoTable;
