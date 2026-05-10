"use client";

import { useMemo } from "react";

import { hasError, type ToolCardProps } from "./types";

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

const CHART_WIDTH = 420;
const CHART_HEIGHT = 96;

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

  const { path, min, max } = useMemo(() => {
    const values = data.points
      .map((p) => p.close)
      .filter((x): x is number => typeof x === "number");
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;
    const path = values
      .map((value, i) => {
        const x = i * stepX;
        const y = CHART_HEIGHT - ((value - min) / range) * CHART_HEIGHT;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { path, min, max };
  }, [data.points]);

  const positive = (data.stats.changePercent ?? 0) >= 0;
  const strokeColor = positive ? "#34d399" : "#f87171";
  const fillColor = positive
    ? "rgba(52, 211, 153, 0.15)"
    : "rgba(248, 113, 113, 0.15)";

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
      <div className="px-3 pb-2">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="mt-2 h-20 w-full"
          aria-hidden
        >
          <path
            d={`${path} L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`}
            fill={fillColor}
          />
          <path d={path} fill="none" stroke={strokeColor} strokeWidth={1.5} />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatCurrency(min, data.currency)}</span>
          <span>{formatCurrency(max, data.currency)}</span>
        </div>
      </div>
    </div>
  );
}
