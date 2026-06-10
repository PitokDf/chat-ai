"use client";

import { hasError, type ToolCardProps } from "./types";
import { StockChart } from "@/components/workspace/stock-chart";

type HistoryOutput = {
  symbol: string;
  currency: string | null;
  exchange: string | null;
  range: string;
  interval: string;
  stats: {
    first: number | null;
    last: number | null;
    min: number | null;
    max: number | null;
    changePercent: number | null;
    points: number;
  };
  points: Array<{
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
  }>;
};

const formatCurrency = (value: number | null, currency: string | null) => {
  if (value === null) return "-";
  return `${currency ? `${currency} ` : ""}${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  })}`;
};

export function StockHistoryCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as HistoryOutput | undefined;
  if (!data || data.points.length === 0) return null;

  const positive = (data.stats.changePercent ?? 0) >= 0;

  const chartData = data.points
    .filter(
      (p) =>
        p.open !== null &&
        p.high !== null &&
        p.low !== null &&
        p.close !== null,
    )
    .map((p) => ({
      date: p.date,
      open: p.open!,
      high: p.high!,
      low: p.low!,
      close: p.close!,
      volume: p.volume ?? 0,
    }));

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {data.symbol}
            </span>
            {data.exchange ? (
              <span className="text-[10px] text-muted-foreground">
                {data.exchange}
              </span>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {data.range} · {data.interval} · {data.stats.points} pts
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(data.stats.last, data.currency)}
          </p>
          <p
            className={`text-[11px] ${
              positive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {data.stats.changePercent !== null
              ? `${data.stats.changePercent.toFixed(2)}%`
              : "-"}
          </p>
        </div>
      </div>
      <div className="px-1 pb-2">
        <div className="h-[250px]">
          <StockChart data={chartData} symbol={data.symbol} />
        </div>
        <div className="mt-1 flex justify-between px-2 text-[10px] text-muted-foreground">
          <span>Low: {formatCurrency(data.stats.min, data.currency)}</span>
          <span>High: {formatCurrency(data.stats.max, data.currency)}</span>
        </div>
      </div>
    </div>
  );
}
