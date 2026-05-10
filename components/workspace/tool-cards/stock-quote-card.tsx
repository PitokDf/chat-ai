"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { hasError, type ToolCardProps } from "./types";

type Quote = {
  symbol: string;
  name?: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string | null;
  exchange: string | null;
  source?: "yahoo" | "stooq" | null;
  error?: string;
};

const formatNumber = (value: number | null, currency: string | null) => {
  if (value === null) return "-";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : abs >= 10 ? 2 : 4;
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${currency ? `${currency} ` : ""}${formatter.format(value)}`;
};

const formatCompact = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
};

export function StockQuoteCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as { quotes?: Quote[] } | undefined;
  const quotes = data?.quotes ?? [];
  if (quotes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="divide-y divide-border">
        {quotes.map((quote) => {
          if (quote.error) {
            return (
              <div
                key={quote.symbol}
                className="px-3 py-2 text-[11px] text-destructive"
              >
                <span className="font-mono">{quote.symbol}</span> ·{" "}
                {quote.error}
              </div>
            );
          }
          const positive = (quote.change ?? 0) >= 0;
          return (
            <div
              key={quote.symbol}
              className="flex items-center gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-semibold text-foreground">
                    {quote.symbol}
                  </span>
                  {quote.exchange ? (
                    <span className="text-[10px] text-muted-foreground">
                      {quote.exchange}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {quote.name}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>
                    Prev{" "}
                    <span className="text-foreground/80">
                      {formatNumber(quote.previousClose, quote.currency)}
                    </span>
                  </span>
                  <span>
                    H{" "}
                    <span className="text-foreground/80">
                      {formatNumber(quote.dayHigh, quote.currency)}
                    </span>
                  </span>
                  <span>
                    L{" "}
                    <span className="text-foreground/80">
                      {formatNumber(quote.dayLow, quote.currency)}
                    </span>
                  </span>
                  <span>
                    Vol{" "}
                    <span className="text-foreground/80">
                      {formatCompact(quote.volume)}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-base font-semibold text-foreground">
                  {formatNumber(quote.price, quote.currency)}
                </span>
                <span
                  className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] ${
                    positive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {positive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {quote.change !== null ? quote.change.toFixed(2) : "-"} (
                  {quote.changePercent !== null
                    ? `${quote.changePercent.toFixed(2)}%`
                    : "-"}
                  )
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
